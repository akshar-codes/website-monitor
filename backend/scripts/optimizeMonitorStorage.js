import mongoose from "mongoose";
import HealthCheck from "../src/models/HealthCheck.js";
import env from "../src/config/env.js";

const collection = HealthCheck.collection;
const recentChecksIndex = "monitor_1_checkedAt_-1__id_-1";
const redundantIndexes = ["monitor_1", "monitor_1_checkedAt_-1"];

try {
  await mongoose.connect(env.MONGO_URI);

  await collection.createIndex(
    { monitor: 1, checkedAt: -1, _id: -1 },
    { name: recentChecksIndex },
  );

  const currentIndexes = await collection.indexes();
  for (const name of redundantIndexes) {
    if (currentIndexes.some((index) => index.name === name)) {
      await collection.dropIndex(name);
      console.log(`Dropped redundant health-check index: ${name}`);
    }
  }

  console.log("Health-check index optimization completed.");
} catch (error) {
  console.error("Health-check index optimization failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
