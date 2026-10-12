import http from 'http';
import { createApp } from './app.js';
import { initSocketServer } from './sockets/index.js';
import { env } from './config/env.js';
import { closeDbPool } from './db/index.js';

const app = createApp();
const httpServer = http.createServer(app);
const io = initSocketServer(httpServer, app);

const server = httpServer.listen(env.PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Customer Support Chat Backend running on port ${env.PORT}`);
  console.log(`🌐 Mode: ${env.NODE_ENV}`);
  console.log(`🔗 Allowed Client URL: ${env.CLIENT_URL}`);
  console.log(`📡 WebSocket / Socket.IO ready`);
  console.log(`===============================================`);
});

const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  // Close HTTP and WebSocket server
  server.close(async () => {
    console.log('🔌 HTTP and WebSocket servers closed.');

    // Close Socket.IO connections
    io.close(() => {
      console.log('🔌 Socket.IO connections terminated.');
    });

    // Close Database pool
    await closeDbPool();

    console.log('✅ Graceful shutdown complete. Exiting.');
    process.exit(0);
  });

  // Force exit if not gracefully closed after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Forcefully terminating after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
