import { Schema, model, Document } from "mongoose";

export interface ILog extends Document {
  mac: string;
  ip?: string;
  url: string;
  hostname?: string;
  method: string;
  blocked: boolean;
  statusCode?: number;
  dataLength?: number;
  timestamp: Date;
}

const LogSchema = new Schema<ILog>({
  mac: { type: String, required: true },
  ip: String,
  url: { type: String, required: true },
  hostname: String,
  method: { type: String, required: true },
  blocked: { type: Boolean, default: false },
  statusCode: Number,
  dataLength: Number,
  timestamp: { type: Date, default: Date.now },
});

export default model<ILog>("Log", LogSchema);
