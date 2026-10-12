import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema/users.js';

export class UserRepository {
  async findByEmail(email) {
    const normalized = email.trim().toLowerCase();
    const [user] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
    return user || null;
  }

  async findById(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user || null;
  }

  async createUser({ name, email, passwordHash, role = 'customer' }) {
    const normalized = email.trim().toLowerCase();
    const [newUser] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: normalized,
        passwordHash,
        role,
      })
      .returning();
    return newUser;
  }
}

export const userRepository = new UserRepository();
