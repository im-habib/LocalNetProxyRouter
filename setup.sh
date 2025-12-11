#!/bin/sh

echo "Initializing Bun project..."
bun init -y

# Directory structure
mkdir -p src
mkdir -p db/models
mkdir -p config

# Files inside src/
touch src/index.ts
touch src/proxy.ts
touch src/policyEngine.ts
touch src/deviceDetector.ts
touch src/logger.ts
touch src/analytics.ts

# DB models
touch db/models/Device.ts
touch db/models/Policy.ts
touch db/models/Log.ts
touch db/models/Stats.ts

# Config
touch config/default.ts

# PM2 equivalent is optional; Bun can run as a background service using Bun’s process manager or systemd
# ecosystem.config.js is not required for Bun, but you can keep if you like

# tsconfig.json (Bun can auto-detect, optional)
cat <<EOF > tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": ".",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "strict": false
  },
  "include": ["src", "db", "config"]
}
EOF

echo "Installing dependencies..."
bun add mongoose http-proxy

echo "Project structure ready for Bun!"
