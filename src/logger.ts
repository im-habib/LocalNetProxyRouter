import LogModel, { ILog } from "../db/models/Log";

export interface LogEntry {
  mac: string;
  url: string;
  method: string;
  blocked: boolean;
  timestamp?: Date;
}

export class Logger {
  /**
   * Log a single packet/event to MongoDB
   */
  public async log(entry: LogEntry): Promise<ILog> {
    const logDoc = new LogModel({
      mac: entry.mac,
      url: entry.url,
      method: entry.method,
      blocked: entry.blocked,
      timestamp: entry.timestamp || new Date(),
    });

    return await logDoc.save();
  }

  public async logRequest(data: Partial<ILog>) {
    try {
      await LogModel.create({
        mac: data.mac || "unknown",
        ip: data.ip,
        url: data.url || "",
        hostname: data.hostname,
        method: data.method || "CONNECT",
        blocked: data.blocked || false,
        statusCode: data.statusCode,
        dataLength: data.dataLength,
        timestamp: new Date(),
      });
    } catch (err) {
      console.warn("Logger error:", err);
    }
  }
}
