import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// Create a new ratelimiter, that allows 10 requests per 10 seconds
// Fallback gracefully if Redis is not configured (e.g. local dev without keys)
export const rateLimit = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, '10 s'),
      analytics: true,
      prefix: '@upstash/ratelimit',
    })
  : null;

export async function checkRateLimit(identifier: string) {
  if (!rateLimit) {
    console.warn('Rate limiting is disabled. UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set.');
    return { success: true }; // Bypass in dev if no keys
  }

  const { success, limit, reset, remaining } = await rateLimit.limit(identifier);

  if (!success) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString()
          }
        }
      )
    };
  }

  return { success: true };
}
