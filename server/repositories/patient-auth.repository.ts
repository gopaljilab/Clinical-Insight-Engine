import { eq, and, gte } from "drizzle-orm";
import { getDb } from "../db";
import { logger } from "../logger";
import {
  patientEmailVerificationTokens,
  patientUsers,
  type PatientUser,
} from "@shared/schema";

export type VerifyOutcome =
  | { success: true }
  | { success: false; status: number; message: string };

export class PatientAuthRepository {
  async createPatientOtp(
    patientUserId: string,
    otp: string,
    expiresAt: Date,
  ): Promise<void> {
    const db = getDb();
    await db.insert(patientEmailVerificationTokens).values({
      patientUserId,
      verificationCode: otp,
      expiresAt,
      used: false,
      attemptCount: 0,
    } as any);
  }

  async replacePatientOtp(
    patientUserId: string,
    otp: string,
    expiresAt: Date,
  ): Promise<void> {
    const db = getDb();
    await db.transaction(async (tx) => {
      // Invalidate old unused tokens for this patient user
      await tx
        .update(patientEmailVerificationTokens)
        .set({ used: true } as any)
        .where(
          and(
            eq(patientEmailVerificationTokens.patientUserId, patientUserId),
            eq(patientEmailVerificationTokens.used, false),
          ),
        );

      await tx
        .insert(patientEmailVerificationTokens)
        .values({
          patientUserId,
          verificationCode: otp,
          expiresAt,
          used: false,
          attemptCount: 0,
        } as any);
    });
  }

  async verifyPatientOtpAndSetVerified(
    patientUser: PatientUser,
    code: string,
  ): Promise<VerifyOutcome> {
    const db = getDb();
    return await db.transaction(async (tx) => {
      const [token] = await tx
        .select()
        .from(patientEmailVerificationTokens)
        .where(
          and(
            eq(patientEmailVerificationTokens.patientUserId, patientUser.id),
            eq(patientEmailVerificationTokens.used, false),
            gte(patientEmailVerificationTokens.expiresAt, new Date()),
          ),
        )
        .orderBy(patientEmailVerificationTokens.createdAt)
        .limit(1);

      if (!token) {
        return {
          success: false as const,
          status: 400,
          message:
            "No pending verification found for this email. Please register or sign in again.",
        };
      }

      const maxAttempts = 3;
      if ((token.attemptCount ?? 0) >= maxAttempts) {
        await tx
          .update(patientEmailVerificationTokens)
          .set({ used: true })
          .where(eq(patientEmailVerificationTokens.id, token.id));

        return {
          success: false as const,
          status: 429,
          message:
            "Too many failed attempts. Please register or sign in again.",
        };
      }

      if (token.verificationCode !== code) {
        const newAttemptCount = (token.attemptCount ?? 0) + 1;

        if (newAttemptCount >= maxAttempts) {
          await tx
            .update(patientEmailVerificationTokens)
            .set({ attemptCount: newAttemptCount, used: true })
            .where(
              and(
                eq(patientEmailVerificationTokens.id, token.id),
                eq(patientEmailVerificationTokens.used, false),
              ),
            );

          return {
            success: false as const,
            status: 429,
            message:
              "Too many failed attempts. Please register or sign in again.",
          };
        }

        await tx
          .update(patientEmailVerificationTokens)
          .set({ attemptCount: newAttemptCount })
          .where(
            and(
              eq(patientEmailVerificationTokens.id, token.id),
              eq(patientEmailVerificationTokens.used, false),
            ),
          );

        const remaining = maxAttempts - newAttemptCount;
        return {
          success: false as const,
          status: 401,
          message: `Invalid OTP. ${remaining} attempt(s) remaining.`,
        };
      }

      // Code matches — claim it
      const [claimed] = await tx
        .update(patientEmailVerificationTokens)
        .set({ used: true })
        .where(
          and(
            eq(patientEmailVerificationTokens.id, token.id),
            eq(patientEmailVerificationTokens.used, false),
          ),
        )
        .returning();

      if (!claimed) {
        return {
          success: false as const,
          status: 409,
          message: "This code has already been used.",
        };
      }

      // Mark patient email as verified if not already
      if (!patientUser.emailVerified) {
        await tx
          .update(patientUsers)
          .set({
            emailVerified: true,
            updatedAt: new Date(),
          })
          .where(eq(patientUsers.id, patientUser.id));
      }

      return { success: true as const };
    });
  }
}
