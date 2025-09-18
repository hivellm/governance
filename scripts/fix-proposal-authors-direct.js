#!/usr/bin/env node

const Database = require('better-sqlite3');
const http = require('http');
const path = require('path');

function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(JSON.stringify(data)) } : {})
      }
    };

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

const API_BASE = 'http://localhost:23080/api';

async function fixProposalAuthorsDirectly() {
  console.log('🔧 HiveLLM Direct Proposal Author Fixer');
  console.log('📀 Using direct SQLite access for author correction\n');

  // Connect to database
  const dbPath = path.resolve(__dirname, '../governance.db');
  console.log(`📀 Database path: ${dbPath}`);
  
  let db;
  try {
    db = new Database(dbPath);
    console.log('✅ Connected to SQLite database\n');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    process.exit(1);
  }

  // Get all agents for mapping
  console.log('🤖 Loading agents for author mapping...');
  const agentsResponse = await makeRequest(`${API_BASE}/agents?limit=100`);
  const agents = agentsResponse.data.items || [];
  console.log(`📊 Found ${agents.length} agents\n`);
  
  // Create comprehensive author mapping
  const authorMap = {};
  
  agents.forEach(agent => {
    console.log(`  📍 ${agent.name} -> ${agent.id}`);
    
    // Exact agent ID
    authorMap[agent.id] = agent.id;
    
    // Normalized name
    const normalizedName = agent.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    authorMap[normalizedName] = agent.id;
    
    // Organization mapping
    if (agent.organization) {
      authorMap[agent.organization.toLowerCase()] = agent.id;
    }
    
    // Specific model mappings
    if (agent.name.includes('Claude')) {
      authorMap['claude'] = agent.id;
      authorMap['anthropic'] = agent.id;
      if (agent.name.includes('3.7')) authorMap['claude37sonnet'] = agent.id;
      if (agent.name.includes('4')) authorMap['claude4'] = agent.id;
      if (agent.name.includes('Opus')) authorMap['opus'] = agent.id;
      if (agent.name.includes('Sonnet')) authorMap['sonnet'] = agent.id;
    }
    
    if (agent.name.includes('GPT')) {
      authorMap['gpt'] = agent.id;
      authorMap['openai'] = agent.id;
      if (agent.name.includes('4o')) authorMap['gpt4o'] = agent.id;
      if (agent.name.includes('5')) authorMap['gpt5'] = agent.id;
    }
    
    if (agent.name.includes('Gemini')) {
      authorMap['gemini'] = agent.id;
      authorMap['google'] = agent.id;
      if (agent.name.includes('2.5')) authorMap['gemini25'] = agent.id;
    }
    
    if (agent.name.includes('DeepSeek')) {
      authorMap['deepseek'] = agent.id;
      if (agent.name.includes('V3') || agent.name.includes('v3')) authorMap['deepseekv3'] = agent.id;
    }
    
    if (agent.name.includes('Grok')) {
      authorMap['grok'] = agent.id;
      authorMap['xai'] = agent.id;
      if (agent.name.includes('3')) authorMap['grok3'] = agent.id;
      if (agent.name.includes('4')) authorMap['grok4'] = agent.id;
      if (agent.name.includes('Code')) authorMap['grokcode'] = agent.id;
    }
  });
  
  console.log(`\n🔗 Created ${Object.keys(authorMap).length} author mappings\n`);
  
  // Get all proposals that need fixing
  console.log('📝 Querying proposals from database...');
  const proposalsQuery = `
    SELECT id, title, author_id, metadata 
    FROM proposals 
    WHERE author_id = 'temp-agent-id'
    ORDER BY title
  `;
  
  const proposals = db.prepare(proposalsQuery).all();
  console.log(`📊 Found ${proposals.length} proposals with temp-agent-id\n`);
  
  if (proposals.length === 0) {
    console.log('🎉 All proposals already have correct authors!');
    db.close();
    return;
  }
  
  // Helper function to find best author match
  function findBestAuthor(authorString, title) {
    if (!authorString) return null;
    
    const searchText = (authorString + ' ' + title).toLowerCase();
    const normalized = authorString.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    console.log(`    🔍 Searching: "${authorString}" (normalized: "${normalized}")`);
    
    // Direct matches first
    if (authorMap[normalized]) {
      console.log(`    ✅ Direct match: ${normalized} -> ${authorMap[normalized]}`);
      return authorMap[normalized];
    }
    
    // Partial matches
    const partialMatches = Object.entries(authorMap).filter(([key, _]) => 
      (key.length > 3 && (key.includes(normalized) || normalized.includes(key)))
    );
    
    if (partialMatches.length > 0) {
      console.log(`    ✅ Partial match: ${partialMatches[0][0]} -> ${partialMatches[0][1]}`);
      return partialMatches[0][1];
    }
    
    // Context-based matching from title and author
    const contextMatches = [
      { keywords: ['claude', 'anthropic'], agent: agents.find(a => a.name.includes('Claude')) },
      { keywords: ['gpt', 'openai'], agent: agents.find(a => a.name.includes('GPT')) },
      { keywords: ['gemini', 'google'], agent: agents.find(a => a.name.includes('Gemini')) },
      { keywords: ['deepseek'], agent: agents.find(a => a.name.includes('DeepSeek')) },
      { keywords: ['grok', 'xai'], agent: agents.find(a => a.name.includes('Grok')) }
    ];
    
    for (const { keywords, agent } of contextMatches) {
      if (keywords.some(keyword => searchText.includes(keyword)) && agent) {
        console.log(`    ✅ Context match: ${keywords[0]} from text -> ${agent.id}`);
        return agent.id;
      }
    }
    
    console.log(`    ⚠️ No match found for: "${authorString}"`);
    return null;
  }
  
  // Prepare update statement
  const updateStatement = db.prepare('UPDATE proposals SET author_id = ? WHERE id = ?');
  
  let fixed = 0;
  let notFixed = 0;
  
  console.log('🔧 Starting author corrections...\n');
  
  for (const proposal of proposals) {
    let metadata;
    try {
      metadata = JSON.parse(proposal.metadata);
    } catch (e) {
      metadata = {};
    }
    
    const originalAuthor = metadata.author_github;
    const title = proposal.title;
    
    console.log(`📝 [${fixed + notFixed + 1}/${proposals.length}] ${title}`);
    console.log(`    👤 Original author: ${originalAuthor || 'Unknown'}`);
    console.log(`    🆔 Current ID: ${proposal.author_id}`);
    
    const correctAuthorId = findBestAuthor(originalAuthor, title);
    
    if (correctAuthorId && correctAuthorId !== proposal.author_id) {
      try {
        updateStatement.run(correctAuthorId, proposal.id);
        console.log(`    ✅ FIXED: temp-agent-id -> ${correctAuthorId}`);
        fixed++;
      } catch (error) {
        console.log(`    ❌ SQL Error: ${error.message}`);
        notFixed++;
      }
    } else if (correctAuthorId) {
      console.log(`    ✅ Already correct: ${correctAuthorId}`);
    } else {
      console.log(`    ⚠️ Could not find matching agent`);
      notFixed++;
    }
    
    console.log(''); // Blank line for readability
  }
  
  // Close database
  db.close();
  
  console.log('=' .repeat(60));
  console.log('🎯 DIRECT AUTHOR FIXING SUMMARY');
  console.log('=' .repeat(60));
  console.log(`✅ Successfully fixed: ${fixed}`);
  console.log(`⚠️ Could not fix: ${notFixed}`);
  console.log(`📊 Total processed: ${fixed + notFixed}`);
  
  if (fixed > 0) {
    // Get updated statistics via API
    try {
      const statsResponse = await makeRequest(`${API_BASE}/proposals/statistics`);
      console.log('\n📈 Updated System Statistics:');
      console.log(`📝 Total Proposals: ${statsResponse.data.total}`);
      console.log(`📋 By Status: ${JSON.stringify(statsResponse.data.byStatus, null, 2)}`);
      
      // Test a few corrected proposals
      console.log('\n🔍 Sample Corrected Proposals:');
      const sampleResponse = await makeRequest(`${API_BASE}/proposals?limit=5`);
      sampleResponse.data.items.forEach(p => {
        console.log(`  📝 ${p.title} -> Author: ${p.authorId}`);
      });
      
    } catch (error) {
      console.log('⚠️  Could not fetch updated statistics via API');
    }
  }
  
  console.log('\n🎉 Direct author fixing completed!');
}

if (require.main === module) {
  fixProposalAuthorsDirectly().catch(console.error);
}

module.exports = { fixProposalAuthorsDirectly };
