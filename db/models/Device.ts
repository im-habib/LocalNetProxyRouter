import { Schema, model, Document } from "mongoose";

export interface IDevice extends Document {
  mac: string;
  ip: string;
  name?: string;
}

const DeviceSchema = new Schema<IDevice>({
  mac: { type: String, required: true, unique: true },
  ip: String,
  name: String,
});

export default model<IDevice>("Device", DeviceSchema);
