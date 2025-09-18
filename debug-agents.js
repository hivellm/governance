const Database = require('better-sqlite3');
const path = require('path');

// Connect to database
const dbPath = './governance.db';
console.log('🔍 Debugging Agents Database');
console.log(`📁 Database: ${dbPath}`);

try {
  const db = new Database(dbPath);
  
  // Check if agents table exists
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agents'").all();
  console.log('\n📋 Tables found:', tables);
  
  // Get total count
  const count = db.prepare("SELECT COUNT(*) as total FROM agents").get();
  console.log('\n📊 Total agents in database:', count.total);
  
  // Get first 5 agents with all columns
  const agents = db.prepare("SELECT * FROM agents LIMIT 5").all();
  console.log('\n🤖 First 5 agents:');
  agents.forEach((agent, index) => {
    console.log(`\n[${index + 1}]`, {
      id: agent.id,
      name: agent.name,
      organization: agent.organization,
      roles: agent.roles,
      is_active: agent.is_active,
      created_at: agent.created_at
    });
  });
  
  // Test the exact query from the service
  console.log('\n🔍 Testing service query...');
  const serviceQuery = "SELECT * FROM agents ORDER BY last_active DESC LIMIT 50.0 OFFSET 0.0";
  const serviceResults = db.prepare(serviceQuery).all();
  console.log(`Service query returned ${serviceResults.length} results`);
  
  if (serviceResults.length > 0) {
    console.log('First result from service query:', {
      id: serviceResults[0].id,
      name: serviceResults[0].name,
      organization: serviceResults[0].organization
    });
  }
  
  db.close();
  
} catch (error) {
  console.error('❌ Database error:', error.message);
}
