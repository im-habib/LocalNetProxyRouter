import { Schema, model, Document } from "mongoose";

export interface IStats extends Document {
  deviceMac: string;
  date: string; // YYYY-MM-DD
  requestCount: number;
  blockedCount: number;
}

const StatsSchema = new Schema<IStats>({
  deviceMac: String,
  date: String,
  requestCount: { type: Number, default: 0 },
  blockedCount: { type: Number, default: 0 },
});

export default model<IStats>("Stats", StatsSchema);
