import pcap from "pcap";
import EventEmitter from "events";

export class PacketCaptureService extends EventEmitter {
  private session: any = null;

  constructor(private iface: string) {
    super();
  }

  start() {
    this.session = pcap.createSession(this.iface, {
      filter: "ip or ip6",
    });

    console.log(`Listening on ${this.iface}...`);

    this.session.on("packet", (rawPacket: any) => {
      try {
        const packet = pcap.decode.packet(rawPacket);
        this.emit("packet", packet);
      } catch (err) {
        console.warn("Packet parse error:", err);
      }
    });
  }

  stop() {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
  }
}
