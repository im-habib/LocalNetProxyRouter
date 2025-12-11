import { Schema, model, Document } from "mongoose";

interface ISchedule {
  start: string; // HH:MM
  end: string; // HH:MM
  action: "block_all_except_allowlist" | "allow_all";
}

export interface IPolicy extends Document {
  deviceMac: string;
  allowDomains?: string[];
  blockDomains?: string[];
  blockKeywords?: string[];
  schedule?: ISchedule;
}

const PolicySchema = new Schema<IPolicy>({
  deviceMac: { type: String, required: true, unique: true },
  allowDomains: [String],
  blockDomains: [String],
  blockKeywords: [String],
  schedule: {
    start: String,
    end: String,
    action: String,
  },
});

export default model<IPolicy>("Policy", PolicySchema);
