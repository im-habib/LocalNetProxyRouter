import mongoose from "mongoose";

import { main } from "./src";
import config from "./config/default";

(async () => {
  try {
    await mongoose.connect(config.MONGO_URI);
    console.log("Connected to MongoDB");
    await main();
  } catch (error) {
    console.error("Failed to start proxy:", error);
  }
})();
