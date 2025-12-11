FROM node:24

# Install dependencies for pcap
RUN apt-get update && apt-get install -y libpcap-dev python3 make g++ bash

# Set working directory
WORKDIR /app

# Copy package and tsconfig first (for better caching)
COPY package*.json tsconfig.json ./

# Install dependencies
RUN npm install
RUN npm install -g pm2

# Copy the rest of the source code
COPY ./src ./src
COPY ./db ./db
COPY ./config ./config

# Build TypeScript into dist
RUN npx tsc

# Verify build folder exists
RUN ls -l dist

# Expose required ports
EXPOSE 8500 9000

# Start the app with PM2 runtime
CMD ["pm2-runtime", "dist/index.js"]
