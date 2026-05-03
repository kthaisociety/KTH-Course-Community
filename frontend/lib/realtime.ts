"use client";
import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

/**
 * Socket.IO cannot use Next.js HTTP rewrites reliably (WebSocket upgrade).
 * Connect to the API host; CORS is configured on the gateway for WEBSITE_DOMAIN.
 */
export function getReviewsSocket(): Socket {
  if (socket) return socket;

  const backend = process.env.NEXT_PUBLIC_BACKEND_DOMAIN;
  if (!backend) throw new Error("NEXT_PUBLIC_BACKEND_DOMAIN is not set");

  socket = io(`${backend.replace(/\/$/, "")}/reviews`, {
    withCredentials: true,
    transports: ["websocket"],
  });

  return socket;
}
