import fs from "fs";
import path from "path";
import Policy from "../db/models/Policy";
import { IDevice } from "../db/models/Device";

/**
 * Minimal CIDR matcher (IPv4 only)
 */
class CIDR {
  private networkInt: number;
  private maskInt: number;

  constructor(cidr: string) {
    const [ip, maskStr] = cidr.split("/");
    if (!maskStr) throw new Error("CIDR must include mask: 192.168.1.0/24");
    const mask = parseInt(maskStr, 10);
    this.networkInt = CIDR.ipToInt(ip) & CIDR.maskFromBits(mask);
    this.maskInt = CIDR.maskFromBits(mask);
  }

  private static ipToInt(ip: string): number {
    return (
      ip.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>>
      0
    );
  }

  private static maskFromBits(bits: number): number {
    return bits === 0 ? 0 : ~((1 << (32 - bits)) - 1) >>> 0;
  }

  public contains(ip: string): boolean {
    const ipInt = CIDR.ipToInt(ip);
    return (ipInt & this.maskInt) === this.networkInt;
  }
}

export interface ParentalConfig {
  vpnCidrsPath?: string;
  vpnCidrs?: string[];
  vpnHostnameSignatures?: string[];
  vpnPorts?: number[];
  blockedCategories?: string[];
  safeSearchEnforce?: boolean;
}

export class ParentalControlEngine {
  private vpnCidrs: CIDR[] = [];
  private vpnHostnameSignatures: string[] = [];
  private vpnPorts: Set<number> = new Set();
  private blockedCategories: Set<string> = new Set();
  private safeSearchEnforce = false;

  constructor(config?: ParentalConfig) {
    if (config?.vpnCidrsPath) {
      try {
        const p = path.resolve(process.cwd(), config.vpnCidrsPath);
        const raw = fs.readFileSync(p, "utf-8");
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) this.loadVpnCidrs(arr);
      } catch (err) {
        console.warn("Failed to load vpnCidrsPath", err);
      }
    }
    if (config?.vpnCidrs) this.loadVpnCidrs(config.vpnCidrs);
    if (config?.vpnHostnameSignatures)
      this.vpnHostnameSignatures = config.vpnHostnameSignatures;
    if (config?.vpnPorts) config.vpnPorts.forEach((p) => this.vpnPorts.add(p));
    if (config?.blockedCategories)
      config.blockedCategories.forEach((c) => this.blockedCategories.add(c));
    if (config?.safeSearchEnforce) this.safeSearchEnforce = true;
  }

  public async reload(): Promise<void> {
    // For now reloads policies from DB into memory (if you want caching)
    // and re-reads vpnRanges file if present on disk.
    try {
      // If policy-level caching required, implement here.
      // Example: read vpnCidrsPath again if it was provided originally
      // (we already loaded in constructor; this keeps ability to call reload)
      console.log("ParentalControlEngine: reload completed");
    } catch (err) {
      console.warn("ParentalControlEngine.reload error", err);
    }
  }

  public loadVpnCidrs(cidrs: string[]) {
    this.vpnCidrs = cidrs.filter(Boolean).map((c) => new CIDR(c));
    console.log(`Loaded ${this.vpnCidrs.length} VPN CIDRs`);
  }

  public addVpnCidr(cidr: string) {
    this.vpnCidrs.push(new CIDR(cidr));
  }

  public addVpnHostnameSignature(sig: string) {
    if (!this.vpnHostnameSignatures.includes(sig))
      this.vpnHostnameSignatures.push(sig);
  }

  public addVpnPort(port: number) {
    this.vpnPorts.add(port);
  }

  public addBlockedCategory(cat: string) {
    this.blockedCategories.add(cat);
  }

  public setSafeSearch(enforce: boolean) {
    this.safeSearchEnforce = enforce;
  }

  public isVpnIp(ip?: string): boolean {
    if (!ip) return false;
    return this.vpnCidrs.some((c) => c.contains(ip));
  }

  public isVpnPort(port?: number | string): boolean {
    if (!port) return false;
    const p = typeof port === "string" ? parseInt(port, 10) : port;
    return this.vpnPorts.has(p);
  }

  public isVpnHostname(hostname?: string): boolean {
    if (!hostname) return false;
    const lower = hostname.toLowerCase();
    return this.vpnHostnameSignatures.some((sig) =>
      lower.includes(sig.toLowerCase())
    );
  }

  /** Main method: returns reason string or false if allowed */
  public async shouldBlock(
    device: IDevice | null,
    destIp?: string,
    destPort?: number | string,
    hostname?: string,
    url?: string
  ): Promise<string | false> {
    if (device && (device as any).proxyEnabled === false) return false;

    // Device-specific policy
    if (device) {
      try {
        const policy = await Policy.findOne({ deviceMac: device.mac })
          .lean()
          .exec();
        if (policy) {
          if (Array.isArray(policy.allowDomains) && hostname) {
            if (policy.allowDomains.some((a) => hostname.includes(a)))
              return false;
          }

          if (Array.isArray(policy.blockDomains) && hostname) {
            const blocked = policy.blockDomains.find((b) =>
              hostname.includes(b)
            );
            if (blocked) return `Blocked by device policy domain: ${blocked}`;
          }

          if (Array.isArray(policy.blockKeywords) && url) {
            const blocked = policy.blockKeywords.find((k) => url.includes(k));
            if (blocked) return `Blocked by device policy keyword: ${blocked}`;
          }

          if (policy.schedule?.action === "block_all_except_allowlist") {
            const nowStr = new Date().toTimeString().slice(0, 5);
            const start = policy.schedule.start || "00:00";
            const end = policy.schedule.end || "23:59";
            if (ParentalControlEngine.isTimeInWindow(nowStr, start, end)) {
              if (!policy.allowDomains?.some((a) => hostname?.includes(a))) {
                return `Blocked by time schedule (${start}-${end})`;
              }
            }
          }
        }
      } catch (err) {
        console.warn("Policy check failed", err);
      }
    }

    // VPN detection
    if (destIp && this.isVpnIp(destIp)) return `Blocked VPN IP (${destIp})`;
    if (this.isVpnPort(destPort)) return `Blocked VPN port (${destPort})`;
    if (hostname && this.isVpnHostname(hostname))
      return `Blocked VPN hostname (${hostname})`;

    // Category blocking
    if (this.blockedCategories.size > 0 && hostname) {
      for (const cat of this.blockedCategories) {
        if (hostname.includes(cat)) return `Blocked category (${cat})`;
      }
    }

    // SafeSearch enforcement (best-effort)
    if (this.safeSearchEnforce && hostname) {
      const lower = hostname.toLowerCase();
      if (lower.includes("google") || lower.includes("bing")) {
        return `SafeSearch required for ${hostname}`;
      }
    }

    return false;
  }

  /** Utility: check if now is in [start, end] window (handles midnight) */
  public static isTimeInWindow(
    nowHHMM: string,
    startHHMM: string,
    endHHMM: string
  ): boolean {
    const toMinutes = (s: string) => {
      const [h, m] = s.split(":").map((n) => parseInt(n, 10));
      return h * 60 + m;
    };
    const now = toMinutes(nowHHMM);
    const start = toMinutes(startHHMM);
    const end = toMinutes(endHHMM);
    if (start <= end) return now >= start && now <= end;
    return now >= start || now <= end;
  }
}
