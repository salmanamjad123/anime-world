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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Engagement / broadcast email to one recipient (plain text body → simple HTML). */
export async function sendEngagementEmail(
  to: string,
  subject: string,
  body: string
): Promise<void> {
  const resend = getResend();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'https://animevillage.org';
  const paragraphs = body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;line-height:1.6;color:#334155;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <h2 style="color:#2563eb;margin:0 0 16px;">${escapeHtml(SITE_NAME)}</h2>
        ${paragraphs}
        <p style="margin:24px 0 0;">
          <a href="${siteUrl}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Visit ${escapeHtml(SITE_NAME)}</a>
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
        <p style="color:#94a3b8;font-size:12px;margin:0;">You received this because you have an account on ${escapeHtml(SITE_NAME)}.</p>
      </div>
    `,
    text: `${body.trim()}\n\nVisit ${SITE_NAME}: ${siteUrl}`,
  });

  if (error) {
    throw new Error(error.message || 'Failed to send email');
  }
}
