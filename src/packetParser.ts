import { IDevice } from "../db/models/Device";

export interface ParsedPacket extends Partial<IDevice> {
  srcMac?: string;
  dstMac?: string;
  srcIp?: string;
  dstIp?: string;
  protocol?: string;
  hostname?: string;
  url?: string;
}

export class PacketParser {
  parse(packet: any): ParsedPacket {
    try {
      const eth = packet.payload;
      const ip = eth.payload;
      const tcp = ip.payload;

      const parsed: ParsedPacket = {
        srcMac: eth.shost?.toString(),
        dstMac: eth.dhost?.toString(),
        srcIp: ip.saddr?.addr?.join("."),
        dstIp: ip.daddr?.addr?.join("."),
        protocol: ip.protocol_name,
      };

      if (tcp && tcp.payload && tcp.payload.data) {
        const payloadStr = tcp.payload.data.toString();
        const hostMatch = payloadStr.match(/Host: ([^\r\n]+)/i);
        if (hostMatch) parsed.hostname = hostMatch[1];
      }

      return parsed;
    } catch (err) {
      return {};
    }
  }
}
