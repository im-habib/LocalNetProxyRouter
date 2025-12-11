import { DeviceDetector } from "./deviceDetector";
import DeviceModel, { IDevice } from "../db/models/Device";

export class DeviceResolver extends DeviceDetector {
  constructor(subnetPrefix: string) {
    super(subnetPrefix);
  }

  async resolve(mac: string): Promise<IDevice | null> {
    if (!mac) return null;
    let device = await DeviceModel.findOne({ mac }).exec();
    if (!device) {
      device = new DeviceModel({ mac, name: "Unknown Device" });
      await device.save();
    }
    return device;
  }
}
