import crypto from "node:crypto";

const DEFAULT_SECRET = "rentnow-verification-otp";

export function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function getOtpSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.OTP_SECRET || DEFAULT_SECRET;
}

export function hashOtp(code: string, userId: string, target: string): string {
  const secret = getOtpSecret();
  return crypto
    .createHash("sha256")
    .update(`${code}:${userId}:${target}:${secret}`)
    .digest("hex");
}
