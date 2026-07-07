import { eq, and, gte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { logger } from "../logger";
import { users, emailVerificationTokens, passwordResetTokens } from "@shared/schema";
import type { User } from "@shared/schema";

export type VerifyOutcome =
  | { success: true }
  | { success: false; status: number; message: string };

export class AuthRepository {
  async findUserByEmail(email: string): Promise<User | undefined> {
    const db = getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user;
  }

  async registerUserWithOtp(
    userValues: any,
    otp: string,
    expiresAt: Date
  ): Promise<User> {
    const db = getDb();
    return await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values(userValues)
        .returning();

await tx
        .insert(emailVerificationTokens)
        .values({
          userId: newUser.id,
          verificationCode: otp,
          expiresAt,
          used: false,
          attemptCount: 0,
        } as any);

      return newUser;
    });
  }

  async replaceVerificationToken(
    userId: string,
    otp: string,
    expiresAt: Date
  ): Promise<void> {
    const db = getDb();
    await db.transaction(async (tx) => {
      // Invalidate old unused tokens for this user
      await tx
      .update(emailVerificationTokens)
      .set({ used: true } as any)
      .where(
        and(
          eq(emailVerificationTokens.userId, userId),
          eq(emailVerificationTokens.used, false),
        ),
      );

await tx
      .insert(emailVerificationTokens)
      .values({
        userId,
        verificationCode: otp,
        expiresAt,
        used: false,
        attemptCount: 0,
      } as any);
    });
  }

  async setUserEmailVerified(userId: string): Promise<void> {
    const db = getDb();
      await db
      .update(users)
      .set({ emailVerified: true, emailVerifiedAt: new Date(), updatedAt: new Date() } as any)
      .where(eq(users.id, userId));
  }

  async verifyDbTokenAndSetVerified(
    user: User,
    code: string
  ): Promise<VerifyOutcome> {
    const db = getDb();
    return await db.transaction(async (tx) => {
      const [token] = await tx
        .select()
        .from(emailVerificationTokens)
        .where(
          and(
            eq(emailVerificationTokens.userId, user.id),
            eq(emailVerificationTokens.used, false),
            gte(emailVerificationTokens.expiresAt, new Date()),
          ),
        )
        .orderBy(emailVerificationTokens.createdAt)
        .limit(1);

      if (!token) {
        return { success: false as const, status: 400, message: "No valid verification code found. Please request a new code." };
      }

      const maxAttempts = 3;
      if ((token.attemptCount ?? 0) >= maxAttempts) {
        await tx
          .update(emailVerificationTokens)
          .set({ used: true })
          .where(eq(emailVerificationTokens.id, token.id));

        return { success: false as const, status: 429, message: "Too many failed attempts. Please request a new verification code." };
      }

      if (token.verificationCode !== code) {
        const newAttemptCount = (token.attemptCount ?? 0) + 1;

        if (newAttemptCount >= maxAttempts) {
          await tx
            .update(emailVerificationTokens)
            .set({ attemptCount: newAttemptCount, used: true })
            .where(and(
              eq(emailVerificationTokens.id, token.id),
              eq(emailVerificationTokens.used, false),
            ));

          return {
            success: false as const,
            status: 429,
            message: "Too many failed attempts. Please request a new verification code.",
          };
        }

        await tx
          .update(emailVerificationTokens)
          .set({ attemptCount: newAttemptCount })
          .where(and(
            eq(emailVerificationTokens.id, token.id),
            eq(emailVerificationTokens.used, false),
          ));

        const remaining = maxAttempts - newAttemptCount;
        return {
          success: false as const,
          status: 401,
          message: `Invalid code. ${remaining} attempt(s) remaining.`,
        };
      }

      const [claimed] = await tx
        .update(emailVerificationTokens)
        .set({ used: true })
        .where(and(
          eq(emailVerificationTokens.id, token.id),
          eq(emailVerificationTokens.used, false),
        ))
        .returning();

      if (!claimed) {
        return { success: false as const, status: 409, message: "This code has already been used." };
      }

      if (!user.emailVerified) {
        await tx
          .update(users)
          .set({ emailVerified: true, emailVerifiedAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, user.id));
      }

      return { success: true as const };
    });
  }

  async createPasswordResetToken(
    userId: string,
    token: string,
    expiresAt: Date
  ): Promise<void> {
    const db = getDb();
    await db.insert(passwordResetTokens).values({
      userId,
      token,
      expiresAt,
      used: false
    });
  }

  async findPasswordResetToken(token: string) {
    const db = getDb();
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gte(passwordResetTokens.expiresAt, new Date())
        )
      )
      .limit(1);
    return resetToken;
  }

  async consumePasswordResetToken(
    tokenId: string,
    userId: string,
    passwordHash: string
  ): Promise<void> {
    const db = getDb();
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
      await tx.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, tokenId));
      try {
        await tx.execute(sql`DELETE FROM "session" WHERE (sess->'user'->>'id') = ${userId}`);
      } catch (sessErr) {
        console.error("Failed to clear user sessions upon password reset", sessErr);
      }
    });
  }

  async claimPasswordResetToken(
    token: string,
    passwordHash: string
  ): Promise<void> {
    const db = getDb();
    await db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(passwordResetTokens)
        .set({ used: true })
        .where(
          and(
            eq(passwordResetTokens.token, token),
            eq(passwordResetTokens.used, false),
            gte(passwordResetTokens.expiresAt, new Date()),
          ),
        )
        .returning();

      if (!claimed) {
        throw Object.assign(new Error("Invalid or expired reset token."), { statusCode: 400 });
      }

      await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, claimed.userId));

      try {
        await tx.execute(sql`DELETE FROM "session" WHERE (sess->'user'->>'id') = ${claimed.userId}`);
      } catch (sessErr) {
        logger.error({ err: sessErr, userId: claimed.userId }, "Failed to clear user sessions upon password reset");
      }
    });
  }
}