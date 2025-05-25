import { createHash } from 'crypto';
import { LRUCache } from 'lru-cache';

// Cache for webhook delivery IDs to prevent replay attacks
const deliveryCache = new LRUCache<string, boolean>({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour
});

// Rate limiting cache
const rateLimitCache = new LRUCache<string, number>({
  max: 1000,
  ttl: 1000 * 60, // 1 minute
});

export interface WebhookSecurityOptions {
  maxRequestsPerMinute?: number;
  maxPayloadSize?: number;
  allowedEvents?: string[];
}

const DEFAULT_OPTIONS: Required<WebhookSecurityOptions> = {
  maxRequestsPerMinute: 30,
  maxPayloadSize: 5 * 1024 * 1024, // 5MB
  allowedEvents: ['pull_request', 'ping'],
};

export class WebhookSecurityError extends Error {
  constructor(
    message: string,
    public code: 'REPLAY' | 'RATE_LIMIT' | 'PAYLOAD_SIZE' | 'INVALID_EVENT'
  ) {
    super(message);
    this.name = 'WebhookSecurityError';
  }
}

/**
 * Validate webhook security constraints
 */
export async function validateWebhookSecurity(
  deliveryId: string,
  event: string,
  sourceIp: string,
  payloadSize: number,
  options: WebhookSecurityOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Check payload size
  if (payloadSize > opts.maxPayloadSize) {
    throw new WebhookSecurityError(
      `Payload size ${payloadSize} exceeds maximum ${opts.maxPayloadSize}`,
      'PAYLOAD_SIZE'
    );
  }

  // Check allowed events
  if (!opts.allowedEvents.includes(event)) {
    throw new WebhookSecurityError(
      `Event type '${event}' is not allowed`,
      'INVALID_EVENT'
    );
  }

  // Check for replay attacks
  if (deliveryCache.has(deliveryId)) {
    throw new WebhookSecurityError(
      `Duplicate delivery ID: ${deliveryId}`,
      'REPLAY'
    );
  }
  deliveryCache.set(deliveryId, true);

  // Rate limiting per IP
  const rateLimitKey = `webhook:${sourceIp}`;
  const currentCount = rateLimitCache.get(rateLimitKey) || 0;
  
  if (currentCount >= opts.maxRequestsPerMinute) {
    throw new WebhookSecurityError(
      `Rate limit exceeded for IP ${sourceIp}`,
      'RATE_LIMIT'
    );
  }
  
  rateLimitCache.set(rateLimitKey, currentCount + 1);
}

/**
 * Generate a time-based token for additional webhook verification
 */
export function generateWebhookToken(secret: string, timestamp: number): string {
  const hash = createHash('sha256');
  hash.update(`${secret}:${timestamp}`);
  return hash.digest('hex');
}

/**
 * Verify time-based token (valid for 5 minutes)
 */
export function verifyWebhookToken(
  token: string,
  secret: string,
  maxAgeMs: number = 5 * 60 * 1000
): boolean {
  const now = Date.now();
  const minTime = now - maxAgeMs;
  
  // Check tokens for the last maxAgeMs
  for (let time = now; time >= minTime; time -= 1000) {
    const expectedToken = generateWebhookToken(secret, Math.floor(time / 1000));
    if (token === expectedToken) {
      return true;
    }
  }
  
  return false;
}

/**
 * Sanitize webhook payload to prevent XSS or injection
 */
export function sanitizeWebhookPayload<T extends Record<string, any>>(
  payload: T
): T {
  const sanitized = JSON.parse(JSON.stringify(payload));
  
  function sanitizeValue(obj: any): any {
    if (typeof obj === 'string') {
      // Remove any potential script tags or SQL injection attempts
      return obj
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/[<>]/g, '')
        .trim();
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeValue);
    }
    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = sanitizeValue(value);
      }
      return result;
    }
    return obj;
  }
  
  return sanitizeValue(sanitized);
}