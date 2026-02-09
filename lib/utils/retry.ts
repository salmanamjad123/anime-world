/**
 * Retry Utility
 * Exponential backoff retry logic for failed requests
 */

interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = parseInt(process.env.MAX_RETRY_ATTEMPTS || '3'),
    delayMs = parseInt(process.env.RETRY_DELAY_MS || '1000'),
    backoffMultiplier = 2,
    shouldRetry = () => true,
  } = options;

  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if shouldRetry returns false
      if (!shouldRetry(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Helper to determine if error is retryable
export function isRetryableError(error: any): boolean {
  // Network errors - retry
  if (error.name === 'FetchError' || error.code === 'ECONNREFUSED') {
    return true;
  }

  // Rate limiting - retry
  if (error.status === 429) {
    return true;
  }

  // Server errors - retry
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  // Timeout errors - retry (axios uses ECONNABORTED)
  if (error.name === 'AbortError' || error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
    return true;
  }

  // Client errors - don't retry
  if (error.status >= 400 && error.status < 500) {
    return false;
  }

  // Unknown errors - retry
  return true;
}
