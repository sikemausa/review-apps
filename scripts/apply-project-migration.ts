#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { sql } from '@neondatabase/serverless';

// Load environment variables
config({ path: resolve(process.cwd(), '.env') });

async function applyMigration() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  console.log('Applying project tables migration...');
  
  try {
    // Read the migration file
    const migrationPath = resolve(process.cwd(), 'drizzle/0001_add_project_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    // Split by statement breakpoint
    const statements = migrationSQL.split('--> statement-breakpoint').filter(s => s.trim());
    
    // Execute each statement
    const db = sql(DATABASE_URL);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        await db(statement);
      }
    }
    
    console.log('✅ Migration applied successfully!');
    console.log('\nNew tables created:');
    console.log('- project');
    console.log('- deployment');
    console.log('- env_var');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
applyMigration().catch(console.error);