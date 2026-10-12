/**
 * In-Memory Multi-Tab Presence Registry
 * Tracks active socket connections per authenticated user.
 * A user remains online if 1 or more browser tabs/sockets are open.
 * Goes offline only when their final socket disconnects.
 *
 * NOTE: As documented in the architecture, this in-memory registry works
 * for a single Node.js instance. In a distributed multi-node cluster,
 * a Redis-backed Socket.IO adapter and presence store would be used.
 */
class PresenceRegistry {
  constructor() {
    this.userSockets = new Map(); // Map<userId, Set<socketId>>
  }

  addSocket(userId, socketId) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    const sockets = this.userSockets.get(userId);
    const wasOffline = sockets.size === 0;
    sockets.add(socketId);
    return wasOffline; // true if transitioned from offline -> online
  }

  removeSocket(userId, socketId) {
    if (!this.userSockets.has(userId)) {
      return false;
    }
    const sockets = this.userSockets.get(userId);
    sockets.delete(socketId);

    if (sockets.size === 0) {
      this.userSockets.delete(userId);
      return true; // true if transitioned from online -> offline
    }
    return false;
  }

  isUserOnline(userId) {
    return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
  }

  getOnlineUserIds() {
    return Array.from(this.userSockets.keys());
  }

  getSocketCount(userId) {
    return this.userSockets.has(userId) ? this.userSockets.get(userId).size : 0;
  }
}

export const presenceRegistry = new PresenceRegistry();
