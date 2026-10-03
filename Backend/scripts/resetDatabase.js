// Wipe all practice data (therapists, clients, sessions, payments, notes, messages…)
// so the app can be tried again from sign-up. Plan settings (SubscriptionTierConfig) are kept.
//
//   node scripts/resetDatabase.js         -> shows what would be deleted (changes nothing)
//   node scripts/resetDatabase.js --yes   -> deletes it
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ quiet: true });

const COLLECTIONS = [
  "therapists",
  "clients",
  "sessions",
  "sessionnotes",
  "availabilities",
  "availabilityoverrides",
  "bookingrequests",
  "logincodes",
  "payments",
  "messages",
  "notifications",
  "counters",
];

const confirmed = process.argv.includes("--yes");

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;
const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));

console.log(`Database: ${db.databaseName}\n`);
let total = 0;
for (const name of COLLECTIONS) {
  if (!existing.has(name)) continue;
  const count = await db.collection(name).countDocuments();
  total += count;
  if (confirmed) await db.collection(name).deleteMany({});
  console.log(`${confirmed ? "deleted" : "would delete"}  ${String(count).padStart(5)}  ${name}`);
}

console.log(
  confirmed
    ? `\nDone: ${total} documents removed. Sign up again to start fresh.`
    : `\n${total} documents would be removed. Nothing was changed.\nRun again with --yes to delete them.`
);
await mongoose.disconnect();
