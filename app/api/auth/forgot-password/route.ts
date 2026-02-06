/**
 * POST /api/auth/forgot-password
 * Generates Firebase password reset link and sends via Resend (proper inbox delivery)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getAdminAuth } from '@/lib/firebase/admin';
import { SITE_NAME } from '@/constants/site';

const resend = new Resend(process.env.RESEND_API_KEY);

function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    if (!isResendConfigured()) {
      return NextResponse.json(
        { error: 'Email service is not configured' },
        { status: 503 }
      );
    }

    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json(
        { error: 'Auth service not configured' },
        { status: 503 }
      );
    }

    let resetLink: string;
    try {
      resetLink = await adminAuth.generatePasswordResetLink(normalizedEmail);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('user-not-found') || message.includes('USER_NOT_FOUND')) {
        return NextResponse.json(
          { error: 'No account found with this email address.' },
          { status: 404 }
        );
      }
      console.error('[forgot-password] Firebase error:', err);
      return NextResponse.json(
        { error: 'Failed to generate reset link. Please try again.' },
        { status: 500 }
      );
    }

    const { error } = await resend.emails.send({
      from: `${SITE_NAME} <noreply@animevillage.org>`,
      to: normalizedEmail,
      subject: `Reset your password - ${SITE_NAME}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #1e293b;">Reset your password</h2>
          <p>You requested a password reset for your ${SITE_NAME} account.</p>
          <p style="margin: 24px 0;">
            <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Reset Password</a>
          </p>
          <p style="color: #64748b; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">${SITE_NAME}</p>
        </div>
      `,
      text: `Reset your password for ${SITE_NAME}: ${resetLink}\n\nThis link expires in 1 hour.`,
    });

    if (error) {
      console.error('[forgot-password] Resend error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to send email. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset email sent. Check your inbox.',
    });
  } catch (error) {
    console.error('[forgot-password] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request. Please try again.' },
      { status: 500 }
    );
  }
}
