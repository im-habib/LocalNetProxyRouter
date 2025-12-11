import mongoose from "mongoose";
import defaultConfig from "../config/default";

import { PacketParser } from "./packetParser";
import { DeviceResolver } from "./deviceResolver";
import { PacketCaptureService } from "./packetCaptureService";
import { PacketTunnelController } from "./packetTunnelController";

import { Logger } from "./logger";
import { ProxyServer } from "./proxy";
import { ApiServer } from "./ApiServer";
import { PolicyEngine } from "./policyEngine";
import { ParentalControlEngine } from "./parCntEngine";

export async function main() {
  // MongoDB
  await mongoose.connect(defaultConfig.MONGO_URI);
  console.log("MongoDB connected");

  // Device + Policy + Parental
  const detector = new DeviceResolver(
    defaultConfig.SUBNET_PREFIX || "192.168.1"
  );
  const policy = new PolicyEngine();
  const parental = new ParentalControlEngine({
    vpnCidrsPath: "./vpnRanges.json",
    vpnPorts: [1194, 51820, 500, 4500],
  });

  // Logger
  const logger = new Logger();

  // PacketTunnel & PacketCapture (pcap)
  const tunnel = new PacketTunnelController();
  const pcapIface = "utun4";
  const capture = new PacketCaptureService(pcapIface);
  const parser = new PacketParser();

  tunnel.start();
  capture.start();

  // Capture packets and feed into logger + policy
  capture.on("packet", async (raw) => {
    const parsed = parser.parse(raw);
    const device = await detector.resolve(parsed.srcMac || "");

    const blockedReason = await parental.shouldBlock(
      device,
      parsed.dstIp,
      undefined,
      parsed.hostname,
      parsed.url
    );

    await logger.log({
      mac: parsed.srcMac,
      url: parsed.hostname || parsed.url || "",
      method: parsed.protocol || "",
      blocked: !!blockedReason,
    });

    console.log(
      `[${parsed.srcMac}] ${parsed.hostname || parsed.url} → ${
        blockedReason || "ALLOWED"
      }`
    );
  });

  // Proxy server
  const proxy = new ProxyServer(
    defaultConfig.PROXY_PORT,
    detector,
    policy,
    parental,
    logger
  );
  await proxy.start();

  // API server
  const apiApp = new ApiServer(
    defaultConfig.API_PORT,
    proxy,
    detector,
    parental,
    policy
  );
  await apiApp.start();

  console.log(
    `Proxy running on port ${defaultConfig.PROXY_PORT}, API running on port ${defaultConfig.API_PORT}`
  );
}
