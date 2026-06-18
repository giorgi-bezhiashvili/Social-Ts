import { Server as SocketIOServer } from "socket.io";
import http from "http";

let io: SocketIOServer | null = null;

export function initSocket(server: http.Server) {
  if (io) return io;
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_ORIGIN || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    // clients should join their user room after connecting
    socket.on("join", (userId: string) => {
      if (typeof userId === "string") socket.join(userId);
    });

    socket.on("leave", (userId: string) => {
      if (typeof userId === "string") socket.leave(userId);
    });
  });

  return io;
}

export function getIo() {
  if (!io) throw new Error("Socket.io not initialized. Call initSocket(server) first.");
  return io;
}
