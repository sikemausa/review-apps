import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify GitHub webhook signature using HMAC-SHA256
 * @param payload - The raw webhook payload as a string
 * @param signature - The signature from the X-Hub-Signature-256 header
 * @param secret - The webhook secret configured in GitHub
 * @returns Promise<boolean> indicating if the signature is valid
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) {
    return false;
  }

  // GitHub sends the signature in the format "sha256=<hex-digest>"
  const parts = signature.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const providedSignature = parts[1];
  
  // Calculate the expected signature
  const hmac = createHmac('sha256', secret);
  const expectedSignature = hmac.update(payload).digest('hex');
  
  // Convert to buffers for timing-safe comparison
  const providedBuffer = Buffer.from(providedSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  
  // Use timing-safe comparison to prevent timing attacks
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Extract and validate GitHub webhook headers
 */
export function extractWebhookHeaders(headers: Headers) {
  return {
    signature: headers.get('x-hub-signature-256'),
    event: headers.get('x-github-event'),
    deliveryId: headers.get('x-github-delivery'),
    hookId: headers.get('x-github-hook-id'),
    installationId: headers.get('x-github-hook-installation-target-id'),
    targetType: headers.get('x-github-hook-installation-target-type'),
  };
}

/**
 * GitHub webhook event types we handle
 */
export const WEBHOOK_EVENTS = {
  PULL_REQUEST: 'pull_request',
  PUSH: 'push',
  INSTALLATION: 'installation',
  INSTALLATION_REPOSITORIES: 'installation_repositories',
  PING: 'ping',
} as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[keyof typeof WEBHOOK_EVENTS];