import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { socketAuthMiddleware } from './socket.auth.js';
import { registerSocketHandlers } from './socket.handlers.js';

export const initSocketServer = (httpServer, app) => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST', 'PATCH'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Attach io to Express app instance so REST controllers can broadcast events if needed
  app.set('io', io);

  // Authentication middleware
  io.use(socketAuthMiddleware);

  // Connection event
  io.on('connection', (socket) => {
    registerSocketHandlers(io, socket);
  });

  return io;
};
