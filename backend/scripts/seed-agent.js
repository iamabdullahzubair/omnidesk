import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { db, closeDbPool } from '../src/db/index.js';
import { users } from '../src/db/schema/users.js';
import { userRepository } from '../src/repositories/user.repository.js';

dotenv.config();

const seedAgent = async () => {
  const email = process.env.AGENT_EMAIL;
  const password = process.env.AGENT_INITIAL_PASSWORD;
  const name = process.env.AGENT_NAME || 'Alex Support';

  if (!email || !password) {
    console.error('❌ Error: AGENT_EMAIL and AGENT_INITIAL_PASSWORD environment variables are required.');
    process.exit(1);
  }

  console.log(`🌱 Seeding initial support agent: ${email}...`);

  try {
    const existing = await userRepository.findByEmail(email);

    if (existing) {
      if (existing.role !== 'agent') {
        console.log(`⚠️ User with email ${email} already exists but has role '${existing.role}'. Upgrading to 'agent'...`);
        await db.update(users).set({ role: 'agent' }).where(eq(users.id, existing.id));
      } else {
        console.log(`ℹ️ Agent account with email ${email} already exists. Skipping insertion.`);
      }
    } else {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const agent = await userRepository.createUser({
        name,
        email,
        passwordHash,
        role: 'agent',
      });

      console.log(`✅ Support agent created successfully: ${agent.name} (${agent.email}) [ID: ${agent.id}]`);
    }
  } catch (error) {
    console.error('❌ Failed to seed agent account:', error);
    process.exitCode = 1;
  } finally {
    await closeDbPool();
  }
};

seedAgent();
