/**
 * Email Service
 * Sends verification codes via Nodemailer (Gmail app password, etc.)
 */

import nodemailer from 'nodemailer';

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Anime Village';

// Gmail defaults - only SMTP_USER and SMTP_APP_PASSWORD needed from env
const GMAIL_HOST = 'smtp.gmail.com';
const GMAIL_PORT = 587;

function getTransporter() {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_APP_PASSWORD?.trim().replace(/\s/g, ''); // Remove spaces from app password

  if (!user || !pass) {
    throw new Error('SMTP not configured: set SMTP_USER and SMTP_APP_PASSWORD in env');
  }

  return nodemailer.createTransport({
    host: GMAIL_HOST,
    port: GMAIL_PORT,
    secure: false,
    auth: { user, pass },
  });
}

export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_APP_PASSWORD);
}

export async function sendVerificationCode(to: string, code: string): Promise<void> {
  const transporter = getTransporter();
  const from = process.env.SMTP_USER!;

  await transporter.sendMail({
    from: `"${SITE_NAME}" <${from}>`,
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
}
