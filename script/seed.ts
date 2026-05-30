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

    const samples = [
      {
        gender: "Male",
        age: 45,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "never",
        bmi: 24.5,
        hba1cLevel: 5.2,
        bloodGlucoseLevel: 95,
        riskScore: 12.3,
        riskCategory: "LOW",
        factors: [
          { name: "Age", impact: "positive", description: "Increases risk" },
          { name: "Bmi", impact: "negative", description: "Lowers risk" },
          { name: "Hba1c Level", impact: "negative", description: "Lowers risk" }
        ],
        confidenceInterval: "8.5% - 16.1%",
        modelConfidence: 0.8770
      },
      {
        gender: "Female",
        age: 62,
        hypertension: true,
        heartDisease: false,
        smokingHistory: "former",
        bmi: 31.2,
        hba1cLevel: 6.8,
        bloodGlucoseLevel: 145,
        riskScore: 48.7,
        riskCategory: "MODERATE",
        factors: [
          { name: "Hba1c Level", impact: "positive", description: "Increases risk" },
          { name: "Bmi", impact: "positive", description: "Increases risk" },
          { name: "Hypertension", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "38.9% - 58.5%",
        modelConfidence: 0.5130
      },
      {
        gender: "Male",
        age: 58,
        hypertension: true,
        heartDisease: true,
        smokingHistory: "current",
        bmi: 35.8,
        hba1cLevel: 8.2,
        bloodGlucoseLevel: 198,
        riskScore: 76.4,
        riskCategory: "HIGH",
        factors: [
          { name: "Hba1c Level", impact: "positive", description: "Increases risk" },
          { name: "Blood Glucose Level", impact: "positive", description: "Increases risk" },
          { name: "Heart Disease", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "68.1% - 84.7%",
        modelConfidence: 0.7640
      },
      {
        gender: "Female",
        age: 22,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "never",
        bmi: 21.0,
        hba1cLevel: 4.8,
        bloodGlucoseLevel: 85,
        riskScore: 1.2,
        riskCategory: "LOW",
        factors: [
          { name: "Hba1c Level", impact: "negative", description: "Lowers risk" },
          { name: "Bmi", impact: "negative", description: "Lowers risk" }
        ],
        confidenceInterval: "0.1% - 2.3%",
        modelConfidence: 0.9880
      },
      {
        gender: "Male",
        age: 30,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "never",
        bmi: 23.5,
        hba1cLevel: 5.1,
        bloodGlucoseLevel: 90,
        riskScore: 2.1,
        riskCategory: "LOW",
        factors: [
          { name: "Hba1c Level", impact: "negative", description: "Lowers risk" }
        ],
        confidenceInterval: "0.5% - 3.7%",
        modelConfidence: 0.9790
      },
      {
        gender: "Female",
        age: 35,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "former",
        bmi: 22.0,
        hba1cLevel: 5.3,
        bloodGlucoseLevel: 92,
        riskScore: 3.4,
        riskCategory: "LOW",
        factors: [
          { name: "Hba1c Level", impact: "negative", description: "Lowers risk" }
        ],
        confidenceInterval: "1.1% - 5.7%",
        modelConfidence: 0.9660
      },
      {
        gender: "Male",
        age: 45,
        hypertension: true,
        heartDisease: false,
        smokingHistory: "former",
        bmi: 27.5,
        hba1cLevel: 5.9,
        bloodGlucoseLevel: 105,
        riskScore: 24.5,
        riskCategory: "MODERATE",
        factors: [
          { name: "Hypertension", impact: "positive", description: "Increases risk" },
          { name: "Bmi", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "16.1% - 32.9%",
        modelConfidence: 0.7550
      },
      {
        gender: "Female",
        age: 50,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "current",
        bmi: 29.0,
        hba1cLevel: 6.1,
        bloodGlucoseLevel: 110,
        riskScore: 31.2,
        riskCategory: "MODERATE",
        factors: [
          { name: "Bmi", impact: "positive", description: "Increases risk" },
          { name: "Hba1c Level", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "22.1% - 40.3%",
        modelConfidence: 0.6880
      },
      {
        gender: "Male",
        age: 40,
        hypertension: false,
        heartDisease: true,
        smokingHistory: "never",
        bmi: 26.2,
        hba1cLevel: 5.8,
        bloodGlucoseLevel: 102,
        riskScore: 28.7,
        riskCategory: "MODERATE",
        factors: [
          { name: "Heart Disease", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "19.8% - 37.6%",
        modelConfidence: 0.7130
      },
      {
        gender: "Female",
        age: 65,
        hypertension: true,
        heartDisease: true,
        smokingHistory: "never",
        bmi: 31.5,
        hba1cLevel: 7.2,
        bloodGlucoseLevel: 145,
        riskScore: 78.4,
        riskCategory: "HIGH",
        factors: [
          { name: "Hba1c Level", impact: "positive", description: "Increases risk" },
          { name: "Heart Disease", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "70.3% - 86.5%",
        modelConfidence: 0.7840
      },
      {
        gender: "Male",
        age: 72,
        hypertension: true,
        heartDisease: true,
        smokingHistory: "former",
        bmi: 33.0,
        hba1cLevel: 8.1,
        bloodGlucoseLevel: 180,
        riskScore: 92.1,
        riskCategory: "HIGH",
        factors: [
          { name: "Hba1c Level", impact: "positive", description: "Increases risk" },
          { name: "Age", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "86.8% - 97.4%",
        modelConfidence: 0.9210
      },
      {
        gender: "Male",
        age: 55,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "current",
        bmi: 35.5,
        hba1cLevel: 6.8,
        bloodGlucoseLevel: 135,
        riskScore: 65.3,
        riskCategory: "HIGH",
        factors: [
          { name: "Bmi", impact: "positive", description: "Increases risk" },
          { name: "Hba1c Level", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "56.0% - 74.6%",
        modelConfidence: 0.6530
      },
      {
        gender: "Female",
        age: 78,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "never",
        bmi: 20.5,
        hba1cLevel: 5.2,
        bloodGlucoseLevel: 88,
        riskScore: 12.4,
        riskCategory: "LOW",
        factors: [
          { name: "Age", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "8.6% - 16.2%",
        modelConfidence: 0.8760
      },
      {
        gender: "Female",
        age: 28,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "never",
        bmi: 38.2,
        hba1cLevel: 5.8,
        bloodGlucoseLevel: 115,
        riskScore: 22.1,
        riskCategory: "MODERATE",
        factors: [
          { name: "Bmi", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "13.9% - 30.3%",
        modelConfidence: 0.7790
      },
      {
        gender: "Male",
        age: 33,
        hypertension: true,
        heartDisease: false,
        smokingHistory: "current",
        bmi: 25.8,
        hba1cLevel: 5.6,
        bloodGlucoseLevel: 98,
        riskScore: 20.8,
        riskCategory: "MODERATE",
        factors: [
          { name: "Hypertension", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "12.8% - 28.8%",
        modelConfidence: 0.7920
      },
      {
        gender: "Male",
        age: 25,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "never",
        bmi: 24.0,
        hba1cLevel: 11.5,
        bloodGlucoseLevel: 310,
        riskScore: 99.8,
        riskCategory: "HIGH",
        factors: [
          { name: "Hba1c Level", impact: "positive", description: "Increases risk" },
          { name: "Blood Glucose Level", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "99.4% - 100.0%",
        modelConfidence: 0.9980
      },
      {
        gender: "Female",
        age: 61,
        hypertension: true,
        heartDisease: true,
        smokingHistory: "former",
        bmi: 29.8,
        hba1cLevel: 6.5,
        bloodGlucoseLevel: 128,
        riskScore: 68.2,
        riskCategory: "HIGH",
        factors: [
          { name: "Hba1c Level", impact: "positive", description: "Increases risk" },
          { name: "Heart Disease", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "59.1% - 77.3%",
        modelConfidence: 0.6820
      }
    ];

    for (const sample of samples) {
      await db.insert(schema.assessments).values({
        ...sample,
        createdBy: devEmail
      });
    }

    console.log('✅ Seeded 17 diverse assessment records mapping the clinical spectrum of diabetes');
    
  } catch (err) {
    console.error('Error seeding data:', err);
  } finally {
    await pool.end();
  }
}

seed().catch(console.error);
