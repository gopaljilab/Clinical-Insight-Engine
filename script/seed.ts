import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import bcrypt from 'bcrypt';
import * as schema from '../shared/schema.js';
import 'dotenv/config';

const { Pool } = pkg;

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set in the environment');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool, { schema });

  console.log('🌱 Seeding database with clinician account...');

  const devEmail = process.env.DEV_CLINICIAN_EMAIL || 'drsmith@example.com';
  const devPassword = process.env.DEV_CLINICIAN_PASSWORD || 'password123';
  const fullName = 'Dr. Smith';
  const licenseNumber = 'MD123456789';

  try {
    const passwordHash = await bcrypt.hash(devPassword, 10);

    const [user] = await db.insert(schema.users).values({
      fullName,
      email: devEmail,
      passwordHash,
      medicalLicenseNumber: licenseNumber,
      isActive: true,
      emailVerified: true,
      role: 'provider'
    }).returning();

    console.log(`✅ Seeded clinician user: ${user.email} (${user.id})`);
    
    // Seed terms acceptance
    await db.insert(schema.userTermsAcceptance).values({
      userId: user.id,
      accepted: true,
      termsVersion: '1.0'
    });
    
    console.log('✅ Seeded terms acceptance record');
    
  } catch (err) {
    console.error('Error seeding data:', err);
  } finally {
    await pool.end();
  }
}

seed().catch(console.error);
