import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { userRepository } from '../repositories/user.repository.js';

export const socketAuthMiddleware = async (socket, next) => {
  try {
    const rawToken =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization;

    if (!rawToken) {
      return next(new Error('Authentication error: Token missing in handshake'));
    }

    const token = rawToken.startsWith('Bearer ')
      ? rawToken.slice(7).trim()
      : rawToken.trim();

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }

    const user = await userRepository.findById(decoded.userId);
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    // Attach validated user to socket session
    socket.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error('Socket authentication exception:', error);
    next(new Error('Authentication error: Server internal issue'));
  }
};
