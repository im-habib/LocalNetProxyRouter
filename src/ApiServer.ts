import cors from "cors";
import express from "express";
import bodyParser from "body-parser";

import LogModel from "../db/models/Log";
import DeviceModel from "../db/models/Device";
import PolicyModel from "../db/models/Policy";

import { ProxyServer } from "./proxy";
import { PolicyEngine } from "./policyEngine";
import { DeviceDetector } from "./deviceDetector";
import { ParentalControlEngine } from "./parCntEngine";

export class ApiServer {
  private app = express();
  private port: number;
  private proxy: ProxyServer;
  private policy: PolicyEngine;
  private detector: DeviceDetector;
  private parental: ParentalControlEngine;

  constructor(
    port: number,
    proxy: ProxyServer,
    detector: DeviceDetector,
    parental: ParentalControlEngine,
    policy: PolicyEngine
  ) {
    this.port = port;
    this.proxy = proxy;
    this.detector = detector;
    this.parental = parental;
    this.policy = policy;
  }

  async start() {
    this.app.use(cors());
    this.app.use(bodyParser.json());

    this.routes();

    this.app.listen(this.port, () => {
      console.log(`📡 API Server running on http://localhost:${this.port}`);
    });
  }

  private routes() {
    /** ------------------------------
     * DEVICE ROUTES
     * ------------------------------- */

    // Get all known devices
    this.app.get("/devices", async (_req, res) => {
      const devices = await DeviceModel.find({});
      res.json(devices);
    });

    // Refresh device list from ARP scan
    this.app.post("/devices/refresh", async (_req, res) => {
      const devices = await this.detector.scanNetwork();
      res.json({ updated: true, devices });
    });

    // Enable / disable Internet
    this.app.post("/devices/:mac/toggle", async (req, res) => {
      const { mac } = req.params;
      const { allowed } = req.body;

      await DeviceModel.updateOne({ mac }, { allowed });
      this.policy.reload();
      this.parental.reload();

      res.json({ updated: true });
    });

    /** ------------------------------
     * POLICY ROUTES
     * ------------------------------- */

    // Block a domain for a device
    this.app.post("/policy/block", async (req, res) => {
      const { mac, domain } = req.body;

      await PolicyModel.updateOne(
        { mac },
        { $addToSet: { blockedDomains: domain } },
        { upsert: true }
      );

      this.policy.reload();
      res.json({ success: true });
    });

    // Unblock domain
    this.app.post("/policy/unblock", async (req, res) => {
      const { mac, domain } = req.body;

      await PolicyModel.updateOne(
        { mac },
        { $pull: { blockedDomains: domain } }
      );

      this.policy.reload();
      res.json({ success: true });
    });

    /** ------------------------------
     * PARENTAL CONTROL
     * ------------------------------- */

    // Set time window
    this.app.post("/parental/window", async (req, res) => {
      const { mac, start, end } = req.body;

      await PolicyModel.updateOne(
        { mac },
        { parentalWindow: { start, end } },
        { upsert: true }
      );

      this.parental.reload();
      res.json({ success: true });
    });

    // Enable/disable parental control
    this.app.post("/parental/toggle", async (req, res) => {
      const { mac, enabled } = req.body;

      await PolicyModel.updateOne({ mac }, { parentalEnabled: enabled });
      this.parental.reload();

      res.json({ success: true });
    });

    /** ------------------------------
     * LOGGING
     * ------------------------------- */

    // Get logs (filter optional)
    this.app.get("/logs", async (req, res) => {
      const { mac, limit = 100 } = req.query;

      const filter = mac ? { mac } : {};

      const logs = await LogModel.find(filter)
        .sort({ timestamp: -1 })
        .limit(Number(limit));

      res.json(logs);
    });

    /** ------------------------------
     * PROXY CONTROL
     * ------------------------------- */

    // Stop proxy traffic
    this.app.post("/proxy/stop", async (_req, res) => {
      await this.proxy.stop();
      res.json({ stopped: true });
    });

    // Start proxy traffic
    this.app.post("/proxy/start", async (_req, res) => {
      await this.proxy.start();
      res.json({ started: true });
    });

    // Status
    this.app.get("/proxy/status", (_req, res) => {
      res.json({ running: this.proxy.isRunning() });
    });
  }
}
