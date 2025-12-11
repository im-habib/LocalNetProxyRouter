import EventEmitter from "events";

export class PacketTunnelController extends EventEmitter {
  private running = false;

  constructor() {
    super();
  }

  start() {
    // In real macOS, this would attach NEPacketTunnelProvider
    this.running = true;
    console.log("PacketTunnelController started");
    this.emit("started");
  }

  stop() {
    this.running = false;
    console.log("PacketTunnelController stopped");
    this.emit("stopped");
  }

  isRunning() {
    return this.running;
  }
}
