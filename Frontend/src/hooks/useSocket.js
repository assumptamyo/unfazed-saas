import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = new URL(import.meta.env.VITE_API_BASE_URL).origin;

// One live connection per token, shared by every component that subscribes
const sockets = new Map();

const getSocket = (token) => {
  if (!sockets.has(token)) {
    sockets.set(token, io(SOCKET_URL, { auth: { token }, transports: ["websocket", "polling"] }));
  }
  return sockets.get(token);
};

// Subscribe to real-time events. `handlers` is { eventName: fn }; the latest
// handlers are always used without reconnecting.
export const useSocketEvents = (token, handlers) => {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    if (!token) return undefined;
    const socket = getSocket(token);
    const names = Object.keys(ref.current);
    const bound = names.map((name) => {
      const fn = (payload) => ref.current[name]?.(payload);
      socket.on(name, fn);
      return [name, fn];
    });
    return () => bound.forEach(([name, fn]) => socket.off(name, fn));
  }, [token]); // event names are fixed per component
};

export const disconnectSocket = (token) => {
  sockets.get(token)?.disconnect();
  sockets.delete(token);
};
