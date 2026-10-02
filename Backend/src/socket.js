import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let io = null;

// Real-time updates. Each connection is authenticated with the same JWT as the
// REST API and joins only its own room: "therapist:<id>" or "client:<id>".
// Messages are sent through the REST API; sockets only push them out.
export const initSocket = (httpServer) => {
  io = new Server(httpServer, { cors: { origin: process.env.FRONTEND_URL || "*" } });

  io.use((socket, next) => {
    try {
      const decoded = jwt.verify(socket.handshake.auth?.token || "", process.env.JWT_SECRET);
      if (decoded.role === "client" && decoded.clientId) {
        socket.data.room = `client:${decoded.clientId}`;
      } else if (decoded.therapistId) {
        socket.data.room = `therapist:${decoded.therapistId}`;
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
