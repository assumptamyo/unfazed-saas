import dotenv from "dotenv";
dotenv.config();
// Session times ("09:00") are Indian time; cloud servers run in UTC unless told otherwise
process.env.TZ = process.env.TZ || "Asia/Kolkata";

import http from "http";
import connectDB from "./src/config/db.js";
import app from "./src/app.js";
import { initSocket } from "./src/socket.js";
import { startNotificationScheduler } from "./src/jobs/notificationScheduler.js";

const PORT = process.env.PORT || 5000;

connectDB();

// One HTTP server for both the REST API and real-time messaging
const server = http.createServer(app);
initSocket(server);

// 24-hour reminders and post-session follow-ups
startNotificationScheduler();

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});