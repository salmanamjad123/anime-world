/**
 * Rate Limiter
 * In-memory rate limiting for API protection
 * For production, consider using Redis-based rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  check(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.limits.get(identifier);

    // No entry or expired - create new
    if (!entry || now > entry.resetTime) {
      const resetTime = now + this.windowMs;
      this.limits.set(identifier, { count: 1, resetTime });
      return { allowed: true, remaining: this.maxRequests - 1, resetTime };
    }

    // Check if limit exceeded
    if (entry.count >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }

    // Increment count
    entry.count++;
    this.limits.set(identifier, entry);
    return { allowed: true, remaining: this.maxRequests - entry.count, resetTime: entry.resetTime };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter(
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000')
);

// Auth routes: stricter limits per IP
const AUTH_FORGOT_PASSWORD_LIMIT = 3;
const AUTH_FORGOT_PASSWORD_WINDOW = 60 * 60 * 1000; // 1 hour
const AUTH_SEND_VERIFICATION_LIMIT = 5;
const AUTH_SEND_VERIFICATION_WINDOW = 60 * 60 * 1000; // 1 hour
const AUTH_VERIFY_CODE_LIMIT = 10;
const AUTH_VERIFY_CODE_WINDOW = 15 * 60 * 1000; // 15 min

export const authRateLimiters = {
  forgotPassword: new RateLimiter(AUTH_FORGOT_PASSWORD_LIMIT, AUTH_FORGOT_PASSWORD_WINDOW),
  sendVerification: new RateLimiter(AUTH_SEND_VERIFICATION_LIMIT, AUTH_SEND_VERIFICATION_WINDOW),
  verifyCode: new RateLimiter(AUTH_VERIFY_CODE_LIMIT, AUTH_VERIFY_CODE_WINDOW),
};

// Helper to get client identifier from request
export function getClientIdentifier(request: Request): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  const cfConnecting = request.headers.get('cf-connecting-ip');
  
  return cfConnecting || real || forwarded?.split(',')[0] || 'unknown';
}
