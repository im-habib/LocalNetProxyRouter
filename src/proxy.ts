import net from "net";
import { Logger } from "./logger";
import { PolicyEngine } from "./policyEngine";
import { IDevice } from "../db/models/Device";
import { DeviceDetector } from "./deviceDetector";
import { ParentalControlEngine } from "./parCntEngine";

export class ProxyServer {
  private server: net.Server | null = null;
  private running = false;
  private detector: DeviceDetector;
  private policy: PolicyEngine;
  private parental: ParentalControlEngine;
  private logger: Logger;

  constructor(
    private port: number = 3128,
    detector?: DeviceDetector,
    policy?: PolicyEngine,
    parental?: ParentalControlEngine,
    logger?: Logger
  ) {
    this.detector = detector || new DeviceDetector();
    this.policy = policy || new PolicyEngine();
    this.parental = parental || new ParentalControlEngine();
    this.logger = logger || new Logger();
  }

  public async start(): Promise<void> {
    if (this.running) return;
    // warm up data
    try {
      await this.detector.scanNetwork();
      await this.policy.reload();
      await this.parental.reload();
    } catch (err) {
      console.warn("ProxyServer.start warmup error", err);
    }

    this.server = net.createServer((clientSocket) => {
      clientSocket.once("data", async (chunk) => {
        const header = chunk.toString();
        let hostname = "";
        let destPort = 443;

        if (header.startsWith("CONNECT")) {
          const parts = header.split(" ");
          const hostport = parts[1] || "";
          const [host, portStr] = hostport.split(":");
          hostname = host;
          destPort = portStr ? parseInt(portStr, 10) : 443;
        } else {
          try {
            const firstLine = header.split("\r\n")[0];
            const url = firstLine.split(" ")[1];
            hostname = new URL(url.startsWith("http") ? url : `http://${url}`)
              .hostname;
          } catch {
            hostname = "";
          }
        }

        const clientIp = (clientSocket.remoteAddress || "").replace(
          /^::ffff:/,
          ""
        );
        const device: IDevice | null = await this.detector.getDeviceByIp(
          clientIp
        );

        // Policy checks
        const pBlock = await this.policy.shouldBlock(device, hostname, "");
        const parentBlock = await this.parental.shouldBlock(
          device,
          clientIp,
          destPort,
          hostname,
          ""
        );
        const block = pBlock || parentBlock;

        if (block) {
          clientSocket.write(`HTTP/1.1 403 Forbidden\r\n\r\n${block}`);
          await this.logger.logRequest({
            mac: (device?.mac as string) || "unknown",
            ip: clientIp,
            url: hostname,
            hostname,
            method: header.startsWith("CONNECT") ? "CONNECT" : "HTTP",
            blocked: true,
            statusCode: 403,
            dataLength: 0,
          });
          return clientSocket.destroy();
        }

        // connect to remote server
        const serverSocket = net.connect(destPort, hostname, () => {
          if (header.startsWith("CONNECT")) {
            clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
          } else {
            serverSocket.write(chunk); // forward initial HTTP request bytes
          }

          // stats counters
          let up = 0;
          let down = 0;

          clientSocket.on("data", (d) => {
            up += d.length;
          });
          serverSocket.on("data", (d) => {
            down += d.length;
          });

          clientSocket.pipe(serverSocket);
          serverSocket.pipe(clientSocket);

          const done = async () => {
            await this.logger.logRequest({
              mac: (device?.mac as string) || "unknown",
              ip: clientIp,
              url: hostname,
              hostname,
              method: header.startsWith("CONNECT") ? "CONNECT" : "HTTP",
              blocked: false,
              statusCode: 200,
              dataLength: up + down,
            });
          };

          clientSocket.once("close", done);
          serverSocket.once("close", done);
        });

        serverSocket.on("error", async (err) => {
          // if remote failed, notify client
          try {
            clientSocket.end();
            await this.logger.logRequest({
              mac: (device?.mac as string) || "unknown",
              ip: clientIp,
              url: hostname,
              hostname,
              method: header.startsWith("CONNECT") ? "CONNECT" : "HTTP",
              blocked: false,
              statusCode: 502,
              dataLength: 0,
            });
          } catch {}
        });

        clientSocket.on("error", () => {
          try {
            serverSocket.end();
          } catch {}
        });
      });
    });

    this.server.on("error", (err) => {
      console.error("Proxy server error:", err);
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(this.port, () => {
        this.running = true;
        console.log(`ProxyServer listening on ${this.port}`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.running || !this.server) return;
    await new Promise<void>((resolve) => {
      this.server!.close(() => {
        this.running = false;
        this.server = null;
        console.log("ProxyServer stopped");
        resolve();
      });
    });
  }

  public isRunning(): boolean {
    return this.running;
  }
}
