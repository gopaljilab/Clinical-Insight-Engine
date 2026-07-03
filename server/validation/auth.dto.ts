import { z } from "zod";

export const registerDTOSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(255, "Full name must be 255 characters or less"),
  email: z.string().trim().email("Invalid email format.").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  licenseNumber: z.string().trim().min(1, "Medical license number is required").max(100, "Medical license number must be 100 characters or less"),
});

export const loginDTOSchema = z.object({
  email: z.string().trim().email("Invalid email format").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordDTOSchema = z.object({
  email: z.string().trim().email("Invalid email format").toLowerCase(),
});

export const resetPasswordDTOSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
});

export const verifyEmailDTOSchema = z.object({
  email: z.string().trim().email("Invalid email format").toLowerCase(),
  code: z.string().length(6, "Verification code must be exactly 6 characters").regex(/^\d{6}$/, "Verification code must be a 6-digit number"),
});

export const verifyOtpDTOSchema = z.object({
  email: z.string().trim().email("Invalid email format").toLowerCase(),
  otp: z.string().min(1, "OTP is required"),
});
