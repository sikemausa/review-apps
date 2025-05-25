import { createCipheriv, createDecipheriv, randomBytes, scrypt, createHash } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Use environment variable for encryption key
const getEncryptionKey = async (): Promise<Buffer> => {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET environment variable is not set');
  }
  
  // Derive a proper key from the secret
  const salt = 'review-apps-salt'; // In production, use a proper salt
  const key = (await scryptAsync(secret, salt, 32)) as Buffer;
  return key;
};

/**
 * Encrypt sensitive data (like environment variable values)
 */
export async function encrypt(text: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = randomBytes(16);
  
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine iv, authTag, and encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt sensitive data
 */
export async function decrypt(encryptedText: string): Promise<string> {
  const key = await getEncryptionKey();
  const parts = encryptedText.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Hash sensitive data for comparison (like API keys)
 */
export function hashSecret(secret: string): string {
  const hash = createHash('sha256');
  hash.update(secret);
  return hash.digest('hex');
}

/**
 * Mask sensitive data for display
 */
export function maskSecret(secret: string, visibleChars: number = 4): string {
  if (secret.length <= visibleChars * 2) {
    return '********';
  }
  
  const start = secret.substring(0, visibleChars);
  const end = secret.substring(secret.length - visibleChars);
  const masked = '*'.repeat(Math.max(8, secret.length - visibleChars * 2));
  
  return `${start}${masked}${end}`;
}