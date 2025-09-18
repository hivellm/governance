#!/usr/bin/env node

const http = require('http');

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

async function fixProposalAuthors() {
  console.log('🔧 HiveLLM Proposal Author Fixer');
  console.log(`🌐 API URL: ${API_BASE}\n`);

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
      if (agent.name.includes('3.7')) authorMap['claude37'] = agent.id;
      if (agent.name.includes('4')) authorMap['claude4'] = agent.id;
      if (agent.name.includes('Opus')) authorMap['opus'] = agent.id;
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
      if (agent.name.includes('V3')) authorMap['deepseekv3'] = agent.id;
    }
    
    if (agent.name.includes('Grok')) {
      authorMap['grok'] = agent.id;
      authorMap['xai'] = agent.id;
      if (agent.name.includes('3')) authorMap['grok3'] = agent.id;
      if (agent.name.includes('4')) authorMap['grok4'] = agent.id;
    }
  });
  
  console.log(`\n🔗 Created ${Object.keys(authorMap).length} author mappings\n`);
  
  // Helper function to find best author match
  function findBestAuthor(authorString, title) {
    if (!authorString) return null;
    
    const searchText = (authorString + ' ' + title).toLowerCase();
    const normalized = authorString.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    console.log(`    🔍 Searching for author: "${authorString}" (normalized: "${normalized}")`);
    
    // Direct matches first
    if (authorMap[normalized]) {
      console.log(`    ✅ Direct match: ${normalized} -> ${authorMap[normalized]}`);
      return authorMap[normalized];
    }
    
    // Partial matches
    const partialMatches = Object.entries(authorMap).filter(([key, _]) => 
      key.includes(normalized) || normalized.includes(key)
    );
    
    if (partialMatches.length > 0) {
      console.log(`    ✅ Partial match: ${partialMatches[0][0]} -> ${partialMatches[0][1]}`);
      return partialMatches[0][1];
    }
    
    // Context-based matching from title
    if (searchText.includes('claude')) {
      const claudeAgent = agents.find(a => a.name.includes('Claude'));
      if (claudeAgent) {
        console.log(`    ✅ Context match: Claude from title -> ${claudeAgent.id}`);
        return claudeAgent.id;
      }
    }
    
    if (searchText.includes('gpt')) {
      const gptAgent = agents.find(a => a.name.includes('GPT'));
      if (gptAgent) {
        console.log(`    ✅ Context match: GPT from title -> ${gptAgent.id}`);
        return gptAgent.id;
      }
    }
    
    if (searchText.includes('gemini')) {
      const geminiAgent = agents.find(a => a.name.includes('Gemini'));
      if (geminiAgent) {
        console.log(`    ✅ Context match: Gemini from title -> ${geminiAgent.id}`);
        return geminiAgent.id;
      }
    }
    
    if (searchText.includes('deepseek')) {
      const deepseekAgent = agents.find(a => a.name.includes('DeepSeek'));
      if (deepseekAgent) {
        console.log(`    ✅ Context match: DeepSeek from title -> ${deepseekAgent.id}`);
        return deepseekAgent.id;
      }
    }
    
    if (searchText.includes('grok')) {
      const grokAgent = agents.find(a => a.name.includes('Grok'));
      if (grokAgent) {
        console.log(`    ✅ Context match: Grok from title -> ${grokAgent.id}`);
        return grokAgent.id;
      }
    }
    
    console.log(`    ⚠️ No match found for: "${authorString}"`);
    return null;
  }
  
  // Get all proposals that need fixing
  console.log('📝 Loading proposals to fix...');
  const proposalsResponse = await makeRequest(`${API_BASE}/proposals?limit=100`);
  const proposals = proposalsResponse.data.items || [];
  
  const toFix = proposals.filter(p => p.authorId === 'temp-agent-id');
  
  console.log(`📊 Found ${proposals.length} total proposals`);
  console.log(`🔧 Need to fix ${toFix.length} proposals with temp-agent-id\n`);
  
  if (toFix.length === 0) {
    console.log('🎉 All proposals already have correct authors!');
    return;
  }
  
  let fixed = 0;
  let notFixed = 0;
  
  for (const proposal of toFix) {
    const originalAuthor = proposal.metadata?.author_github;
    const title = proposal.title;
    
    console.log(`📝 [${fixed + notFixed + 1}/${toFix.length}] ${title}`);
    console.log(`    👤 Original author: ${originalAuthor || 'Unknown'}`);
    
    const correctAuthorId = findBestAuthor(originalAuthor, title);
    
    if (correctAuthorId && correctAuthorId !== proposal.authorId) {
      try {
        // Update the proposal's authorId
        const updateResponse = await makeRequest(
          `${API_BASE}/proposals/${proposal.id}`, 
          'PATCH', 
          { authorId: correctAuthorId }
        );
        
        if (updateResponse.status === 200) {
          console.log(`    ✅ Fixed: temp-agent-id -> ${correctAuthorId}`);
          fixed++;
        } else {
          console.log(`    ❌ Failed to update: ${updateResponse.status}`);
          notFixed++;
        }
      } catch (error) {
        console.log(`    ❌ Error updating: ${error.message}`);
        notFixed++;
      }
    } else {
      console.log(`    ⚠️ Could not find matching agent`);
      notFixed++;
    }
    
    console.log(''); // Blank line for readability
  }
  
  console.log('=' .repeat(60));
  console.log('🎯 AUTHOR FIXING SUMMARY');
  console.log('=' .repeat(60));
  console.log(`✅ Successfully fixed: ${fixed}`);
  console.log(`⚠️ Could not fix: ${notFixed}`);
  console.log(`📊 Total processed: ${fixed + notFixed}`);
  
  if (fixed > 0) {
    // Get updated statistics
    const statsResponse = await makeRequest(`${API_BASE}/proposals/statistics`);
    console.log('\n📈 Updated Proposal Statistics:');
    console.log(`📝 Total: ${statsResponse.data.total}`);
    console.log(`📋 By Status: ${JSON.stringify(statsResponse.data.byStatus, null, 2)}`);
  }
  
  console.log('\n🎉 Author fixing completed!');
}

if (require.main === module) {
  fixProposalAuthors().catch(console.error);
}

module.exports = { fixProposalAuthors };
