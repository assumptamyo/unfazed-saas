import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import Client from "./models/Client.js";

let io = null;

// Real-time updates. Each connection is authenticated with the same JWT as the
// REST API and joins only its own room: "therapist:<id>" or "client:<id>".
// Messages are sent through the REST API; sockets push them out and carry
// lightweight signals such as typing indicators.
export const initSocket = (httpServer) => {
  const origins = (process.env.FRONTEND_URL || "").split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);
  io = new Server(httpServer, { cors: { origin: origins.length ? origins : "*" } });

  io.use(async (socket, next) => {
    try {
      const decoded = jwt.verify(socket.handshake.auth?.token || "", process.env.JWT_SECRET);
      if (decoded.role === "client" && decoded.clientId) {
        const client = await Client.findById(decoded.clientId).select("therapist");
        if (!client) return next(new Error("unauthorized"));
        socket.data = { role: "client", clientId: String(client._id), therapistId: String(client.therapist) };
        socket.data.room = `client:${socket.data.clientId}`;
      } else if (decoded.therapistId) {
        socket.data = { role: "therapist", therapistId: String(decoded.therapistId), myClients: new Set() };
        socket.data.room = `therapist:${socket.data.therapistId}`;
      } else {
        return next(new Error("unauthorized"));
      }
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(socket.data.room);

    // "…is typing" — relayed only within a therapist's own client conversations
    socket.on("typing", async (payload = {}) => {
      try {
        if (socket.data.role === "client") {
          io.to(`therapist:${socket.data.therapistId}`).emit("typing", { clientId: socket.data.clientId, from: "client" });
          return;
        }
        const clientId = String(payload.clientId || "");
        if (!/^[a-f0-9]{24}$/.test(clientId)) return;
        if (!socket.data.myClients.has(clientId)) {
          const owns = await Client.exists({ _id: clientId, therapist: socket.data.therapistId });
          if (!owns) return;
          socket.data.myClients.add(clientId);
        }
        io.to(`client:${clientId}`).emit("typing", { clientId, from: "therapist" });
      } catch {
        /* typing is best-effort */
      }
    });
  });

  return io;
};

export const emitTo = (room, event, payload) => {
  if (io) io.to(room).emit(event, payload);
};

// Is anyone from this room connected right now? (used to skip "new message" emails)
export const isOnline = async (room) => {
  if (!io) return false;
  const sockets = await io.in(room).fetchSockets();
  return sockets.length > 0;
};
