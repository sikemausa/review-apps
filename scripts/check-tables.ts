#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve } from 'path';
import { sql } from '@neondatabase/serverless';

// Load environment variables
config({ path: resolve(process.cwd(), '.env') });

async function checkTables() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  try {
    const db = sql(DATABASE_URL);
    
    // Get all tables
    const tables = await db`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    
    console.log('=== Database Tables ===');
    console.log('Found', tables.length, 'tables:\n');
    
    tables.forEach(t => {
      console.log(`✓ ${t.tablename}`);
    });
    
    // Check for our new tables
    const expectedTables = ['project', 'deployment', 'env_var'];
    const tableNames = tables.map(t => t.tablename);
    
    console.log('\n=== Project Tables Status ===');
    expectedTables.forEach(table => {
      if (tableNames.includes(table)) {
        console.log(`✅ ${table} - Created successfully`);
      } else {
        console.log(`❌ ${table} - Not found`);
      }
    });
    
    // Get count of projects
    const projectCount = await db`SELECT COUNT(*) as count FROM project`;
    console.log(`\n📊 Projects in database: ${projectCount[0].count}`);
    
  } catch (error) {
    console.error('Error checking tables:', error);
    process.exit(1);
  }
}

// Run the check
checkTables().catch(console.error);