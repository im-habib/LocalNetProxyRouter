import { promisify } from "node:util";
import { exec } from "node:child_process";

const execAsync = promisify(exec);

export interface NetworkDevice {
  ip: string;
  mac: string;
  vendor?: string;
}

export class DeviceScanner {
  private subnetPrefix: string;

  constructor(subnetPrefix = "192.168.1") {
    this.subnetPrefix = subnetPrefix;
  }

  private async pingSweep(): Promise<void> {
    const jobs = [];
    for (let i = 1; i <= 254; i++) {
      const ip = `${this.subnetPrefix}.${i}`;
      jobs.push(execAsync(`ping -c 1 -W 1 ${ip}`).catch(() => {}));
    }
    await Promise.all(jobs);
  }

  private async getArpTable(): Promise<NetworkDevice[]> {
    const { stdout } = await execAsync("arp -a");
    const devices: NetworkDevice[] = [];

    const lines = stdout.split("\n");
    for (const line of lines) {
      const match = line.match(/\((.*?)\) at ([\w:]+)/);
      if (match) {
        devices.push({ ip: match[1], mac: match[2] });
      }
    }

    return devices;
  }

  public async scanNetwork(): Promise<NetworkDevice[]> {
    await this.pingSweep();
    const arpDevices = await this.getArpTable();
    return arpDevices;
  }
}
