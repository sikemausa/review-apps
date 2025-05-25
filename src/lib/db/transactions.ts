import { db } from '@/src/db';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export type TransactionClient = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

/**
 * Execute a database transaction with automatic rollback on error
 */
export async function withTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    try {
      return await fn(tx);
    } catch (error) {
      // Transaction will automatically rollback
      throw error;
    }
  });
}

/**
 * Execute a database operation with row-level locking
 */
export async function withLock<T>(
  fn: (tx: TransactionClient) => Promise<T>,
  lockTimeout: number = 5000
): Promise<T> {
  return await db.transaction(async (tx) => {
    // Set lock timeout for this transaction
    await tx.execute`SET LOCAL lock_timeout = ${lockTimeout}`;
    
    try {
      return await fn(tx);
    } catch (error: any) {
      if (error.code === '55P03') {
        throw new Error('Could not acquire lock - operation already in progress');
      }
      throw error;
    }
  });
}

/**
 * Retry a transaction on serialization failures
 */
export async function withRetryableTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        // Use SERIALIZABLE isolation for consistency
        await tx.execute`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;
        return await fn(tx);
      });
    } catch (error: any) {
      lastError = error;
      
      // Retry on serialization failures
      if (error.code === '40001' && attempt < maxRetries) {
        console.log(`Transaction serialization failure, retrying (${attempt}/${maxRetries})`);
        // Add jitter to prevent thundering herd
        await new Promise(resolve => 
          setTimeout(resolve, Math.random() * 100 * attempt)
        );
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}

/**
 * Batch insert with chunking for large datasets
 */
export async function batchInsert<T extends Record<string, any>>(
  table: any,
  records: T[],
  chunkSize: number = 1000
): Promise<void> {
  if (records.length === 0) return;
  
  await withTransaction(async (tx) => {
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      await tx.insert(table).values(chunk);
    }
  });
}

/**
 * Upsert operation with conflict handling
 */
export async function upsert<T extends Record<string, any>>(
  table: any,
  record: T,
  conflictColumns: string[],
  updateColumns: string[]
): Promise<T> {
  return await withTransaction(async (tx) => {
    const result = await tx
      .insert(table)
      .values(record)
      .onConflictDoUpdate({
        target: conflictColumns as any,
        set: updateColumns.reduce((acc, col) => {
          acc[col] = record[col];
          return acc;
        }, {} as any),
      })
      .returning();
    
    return result[0];
  });
}