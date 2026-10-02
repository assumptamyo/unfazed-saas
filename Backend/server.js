import dotenv from "dotenv";
dotenv.config();

import http from "http";
import connectDB from "./src/config/db.js";
import app from "./src/app.js";
import { initSocket } from "./src/socket.js";

const PORT = process.env.PORT || 5000;

connectDB();

// One HTTP server for both the REST API and real-time messaging
const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});