module.exports = {
  apps: [
    {
      name: "LocalNetProxy",
      script: "dist/index.js",
      watch: true,
      env: {
        NODE_ENV: "development",
        MONGO_URI:
          process.env.MONGO_URI || "mongodb://localhost:27017/LocalNetProxyDB",
        API_PORT: process.env.API_PORT || 3000,
        PROXY_PORT: process.env.PROXY_PORT || 8080,
        PCAP_IFACE: process.env.PCAP_IFACE || "en0",
        SUBNET_PREFIX: process.env.SUBNET_PREFIX || "192.168.0",
      },
    },
  ],
};
