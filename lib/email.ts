/**
 * Email Service — Resend (verified domain animevillage.org)
 */

import { Resend } from 'resend';

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Anime Village';

/** Branded From — domain must be verified in Resend */
export const EMAIL_FROM =
  process.env.EMAIL_FROM?.trim() ||
  `${SITE_NAME} <hello@animevillage.org>`;

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim();
}

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error('Email not configured: set RESEND_API_KEY in env');
  }
  return new Resend(key);
}

export async function sendVerificationCode(to: string, code: string): Promise<void> {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: `Your verification code: ${code}`,
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
        <h2 style="color: #2563eb;">${SITE_NAME}</h2>
        <p>Your verification code is:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #111;">${code}</p>
        <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes. Do not share it with anyone.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">If you didn't request this code, you can ignore this email.</p>
      </div>
    `,
    text: `Your ${SITE_NAME} verification code is: ${code}. It expires in 10 minutes.`,
  });

  if (error) {
    throw new Error(error.message || 'Failed to send verification email');
  }
}
