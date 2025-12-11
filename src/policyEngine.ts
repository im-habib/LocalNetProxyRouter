import { IDevice } from "../db/models/Device";
import PolicyModel, { IPolicy } from "../db/models/Policy";

export class PolicyEngine {
  private policies: Map<string, IPolicy> = new Map();

  constructor() {
    // optionally call load() here or call reload() from outside
    this.reload();
  }

  /** load all policies into memory (fast lookups) */
  public async reload(): Promise<void> {
    try {
      const all = await PolicyModel.find({}).lean().exec();
      this.policies.clear();
      for (const p of all) {
        if (p && (p as any).deviceMac) {
          this.policies.set((p as any).deviceMac, p as IPolicy);
        }
      }
      console.log(`PolicyEngine: loaded ${this.policies.size} policies`);
    } catch (err) {
      console.warn("PolicyEngine.reload error", err);
    }
  }

  /** check policy for device - returns reason string or false */
  public async shouldBlock(
    device: IDevice | null,
    hostname?: string,
    url?: string
  ): Promise<string | false> {
    if (!device) return false;
    const policy = this.policies.get(device.mac) || null;
    if (!policy) return false;

    // allowlist precedence
    if (Array.isArray(policy.allowDomains) && hostname) {
      for (const a of policy.allowDomains) {
        if (hostname.includes(a)) return false;
      }
    }

    // block domains
    if (Array.isArray(policy.blockDomains) && hostname) {
      for (const b of policy.blockDomains) {
        if (hostname.includes(b)) return `Blocked by policy domain: ${b}`;
      }
    }

    // block keywords in URL
    if (Array.isArray(policy.blockKeywords) && url) {
      for (const k of policy.blockKeywords) {
        if (url.includes(k)) return `Blocked by policy keyword: ${k}`;
      }
    }

    // schedule support (block_all_except_allowlist)
    if (
      policy.schedule &&
      policy.schedule.action === "block_all_except_allowlist"
    ) {
      const nowStr = new Date().toTimeString().slice(0, 5);
      const start = policy.schedule.start || "00:00";
      const end = policy.schedule.end || "23:59";
      if (PolicyEngine.isTimeInWindow(nowStr, start, end)) {
        if (Array.isArray(policy.allowDomains) && hostname) {
          const allowed = policy.allowDomains.some((a) => hostname.includes(a));
          if (!allowed) return `Blocked by schedule (${start}-${end})`;
        } else {
          return `Blocked by schedule (${start}-${end})`;
        }
      }
    }

    return false;
  }

  /** Utility for time window check (same as parental) */
  public static isTimeInWindow(
    nowHHMM: string,
    startHHMM: string,
    endHHMM: string
  ): boolean {
    const toMinutes = (s: string) => {
      const [hh, mm] = s.split(":").map((n) => parseInt(n, 10));
      return hh * 60 + mm;
    };
    const now = toMinutes(nowHHMM);
    const start = toMinutes(startHHMM);
    const end = toMinutes(endHHMM);
    if (start <= end) return now >= start && now <= end;
    return now >= start || now <= end;
  }
}
