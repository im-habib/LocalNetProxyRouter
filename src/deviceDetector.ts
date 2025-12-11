// src/DeviceDetector.ts
import { promisify } from "node:util";
import { exec as execCb } from "node:child_process";
import DeviceModel, { IDevice } from "../db/models/Device";

const exec = promisify(execCb);

export interface NetworkDevice {
  ip: string;
  mac: string;
  vendor?: string;
}

export class DeviceDetector {
  private subnetPrefix: string;

  // pass prefix like "192.168.1" or auto-detect by env/config
  constructor(subnetPrefix = "192.168.1") {
    this.subnetPrefix = subnetPrefix;
  }

  /** Ping sweep 1..254 to populate ARP table (best-effort) */
  private async pingSweep(): Promise<void> {
    const jobs: Promise<any>[] = [];
    for (let i = 1; i <= 254; i++) {
      const ip = `${this.subnetPrefix}.${i}`;
      // -c 1 for macOS/linux, -W 1 short timeout (linux). swallow errors
      jobs.push(exec(`ping -c 1 -W 1 ${ip}`).catch(() => {}));
    }
    await Promise.allSettled(jobs);
  }

  /** Parse `arp -a` output into list of {ip, mac} */
  private async readArpTable(): Promise<NetworkDevice[]> {
    try {
      const { stdout } = await exec("arp -a");
      const lines = stdout.split("\n");
      const devices: NetworkDevice[] = [];

      for (const line of lines) {
        // match common formats:
        // ? (192.168.1.10) at a4:5e:60:12:9f:bb on en0 ifscope [ethernet]
        // 192.168.1.10 ether a4:5e:60:12:9f:bb C eth0
        const m1 = line.match(/\(([\d.]+)\)\s+at\s+([0-9a-f:]{17})/i);
        const m2 = line.match(/([\d.]+)\s+ether\s+([0-9a-f:]{17})/i);
        if (m1) {
          devices.push({ ip: m1[1], mac: m1[2].toLowerCase() });
          continue;
        }
        if (m2) {
          devices.push({ ip: m2[1], mac: m2[2].toLowerCase() });
        }
      }

      return devices;
    } catch (err) {
      console.warn("DeviceDetector: arp read failed", err);
      return [];
    }
  }

  /** Public: scan network, update Device collection with ip/mac */
  public async scanNetwork(): Promise<NetworkDevice[]> {
    // 1) ping sweep to populate arp table
    await this.pingSweep();

    // 2) read arp table
    const devices = await this.readArpTable();

    // 3) upsert into MongoDB
    for (const d of devices) {
      try {
        await DeviceModel.updateOne(
          { mac: d.mac },
          { mac: d.mac, ip: d.ip },
          { upsert: true }
        ).exec();
      } catch (err) {
        console.warn("DeviceDetector: failed to upsert device", d, err);
      }
    }

    return devices;
  }

  /** Get single device by IP from DB */
  public async getDeviceByIp(ip: string): Promise<IDevice | null> {
    if (!ip) return null;
    return DeviceModel.findOne({ ip }).lean().exec();
  }

  /** Optionally: get by MAC */
  public async getDeviceByMac(mac: string): Promise<IDevice | null> {
    if (!mac) return null;
    return DeviceModel.findOne({ mac: mac.toLowerCase() }).lean().exec();
  }
}
