#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
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
const GOV_PATH = path.resolve(__dirname, '../../gov');

async function cleanAndFixProposals() {
  console.log('🧹 HiveLLM Proposal Cleaner & Fixer');
  console.log(`🌐 API URL: ${API_BASE}`);
  console.log(`📁 Gov path: ${GOV_PATH}\n`);

  // Get current system state
  console.log('📊 Loading current system state...');
  const [agentsResponse, proposalsResponse, statsResponse] = await Promise.all([
    makeRequest(`${API_BASE}/agents?limit=100`),
    makeRequest(`${API_BASE}/proposals?limit=200`),
    makeRequest(`${API_BASE}/proposals/statistics`)
  ]);

  const agents = agentsResponse.data.items || [];
  const proposals = proposalsResponse.data.items || [];
  const stats = statsResponse.data;

  console.log(`🤖 Agents: ${agents.length}`);
  console.log(`📝 Proposals: ${proposals.length}`);
  console.log(`📊 Stats: ${JSON.stringify(stats, null, 2)}\n`);

  // Create author mapping
  console.log('🔗 Creating author mapping...');
  const authorMap = {};
  agents.forEach(agent => {
    console.log(`  📍 ${agent.name} -> ${agent.id}`);
    
    // Multiple mapping strategies
    const normalizedName = agent.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    authorMap[normalizedName] = agent.id;
    authorMap[agent.organization?.toLowerCase()] = agent.id;
    
    // Model-specific mappings
    if (agent.name.includes('Claude')) {
      authorMap['claude'] = agent.id;
      authorMap['anthropic'] = agent.id;
      if (agent.name.includes('3.7')) authorMap['claude37'] = agent.id;
      if (agent.name.includes('4')) authorMap['claude4'] = agent.id;
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
    }
    if (agent.name.includes('DeepSeek')) {
      authorMap['deepseek'] = agent.id;
    }
    if (agent.name.includes('Grok')) {
      authorMap['grok'] = agent.id;
      authorMap['xai'] = agent.id;
    }
  });

  console.log(`🔗 Created ${Object.keys(authorMap).length} author mappings\n`);

  // Find best author match
  function findBestAuthor(originalAuthor, title) {
    if (!originalAuthor) return null;
    
    const searchText = (originalAuthor + ' ' + title).toLowerCase();
    const normalized = originalAuthor.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Direct match
    if (authorMap[normalized]) {
      return { id: authorMap[normalized], method: `direct(${normalized})` };
    }
    
    // Partial matches
    const partialMatches = Object.entries(authorMap).filter(([key, _]) => 
      key.length > 3 && (key.includes(normalized) || normalized.includes(key))
    );
    if (partialMatches.length > 0) {
      return { id: partialMatches[0][1], method: `partial(${partialMatches[0][0]})` };
    }
    
    // Context matching from title/author
    const contextMap = [
      { keywords: ['claude', 'anthropic'], find: a => a.name.includes('Claude') },
      { keywords: ['gpt', 'openai'], find: a => a.name.includes('GPT') },
      { keywords: ['gemini', 'google'], find: a => a.name.includes('Gemini') },
      { keywords: ['deepseek'], find: a => a.name.includes('DeepSeek') },
      { keywords: ['grok', 'xai'], find: a => a.name.includes('Grok') }
    ];
    
    for (const { keywords, find } of contextMap) {
      if (keywords.some(k => searchText.includes(k))) {
        const agent = agents.find(find);
        if (agent) {
          return { id: agent.id, method: `context(${keywords[0]})` };
        }
      }
    }
    
    return null;
  }

  // Identify duplicates and fix authors
  console.log('🔍 Analyzing proposals for duplicates and author issues...');
  
  const duplicateGroups = new Map(); // title -> [proposals]
  const authorsToFix = [];
  const validProposals = [];
  
  proposals.forEach(proposal => {
    const normalizedTitle = proposal.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (!duplicateGroups.has(normalizedTitle)) {
      duplicateGroups.set(normalizedTitle, []);
    }
    duplicateGroups.get(normalizedTitle).push(proposal);
    
    // Check if author needs fixing
    if (proposal.authorId === 'temp-agent-id') {
      const originalAuthor = proposal.metadata?.author_github;
      const authorMatch = findBestAuthor(originalAuthor, proposal.title);
      
      if (authorMatch) {
        authorsToFix.push({
          proposal,
          correctAuthor: authorMatch,
          originalAuthor
        });
      }
    }
  });

  // Find actual duplicates (groups with more than 1 proposal)
  const duplicatesList = Array.from(duplicateGroups.entries())
    .filter(([_, proposals]) => proposals.length > 1)
    .map(([title, proposals]) => ({ title, proposals }));

  console.log(`📊 Analysis Results:`);
  console.log(`  🔍 Duplicate groups: ${duplicatesList.length}`);
  console.log(`  👤 Authors to fix: ${authorsToFix.length}`);
  
  // Show duplicate details
  if (duplicatesList.length > 0) {
    console.log('\n📋 Duplicate Groups Found:');
    duplicatesList.forEach(({ title, proposals }, index) => {
      console.log(`  ${index + 1}. "${proposals[0].title}" (${proposals.length} copies)`);
      proposals.forEach((p, i) => {
        console.log(`     [${i + 1}] ID: ${p.id.substring(0, 8)}... | Author: ${p.authorId}`);
      });
    });
  }

  // Clean duplicates - keep the one with best author or most recent
  console.log('\n🧹 Cleaning duplicates...');
  let deletedCount = 0;
  
  for (const { title, proposals } of duplicatesList) {
    if (proposals.length <= 1) continue;
    
    // Sort by preference: real author > temp-agent-id, then by creation date
    proposals.sort((a, b) => {
      const aHasRealAuthor = a.authorId !== 'temp-agent-id' ? 1 : 0;
      const bHasRealAuthor = b.authorId !== 'temp-agent-id' ? 1 : 0;
      
      if (aHasRealAuthor !== bHasRealAuthor) {
        return bHasRealAuthor - aHasRealAuthor; // Real author first
      }
      
      return new Date(b.createdAt) - new Date(a.createdAt); // Most recent first
    });
    
    const keepProposal = proposals[0];
    const deleteProposals = proposals.slice(1);
    
    console.log(`\n📝 "${keepProposal.title}"`);
    console.log(`  ✅ Keeping: ${keepProposal.id.substring(0, 8)}... (Author: ${keepProposal.authorId})`);
    
    // Delete duplicates
    for (const proposal of deleteProposals) {
      try {
        const deleteResponse = await makeRequest(`${API_BASE}/proposals/${proposal.id}`, 'DELETE');
        if (deleteResponse.status === 200 || deleteResponse.status === 204) {
          console.log(`  🗑️  Deleted: ${proposal.id.substring(0, 8)}... (Author: ${proposal.authorId})`);
          deletedCount++;
        } else {
          console.log(`  ❌ Failed to delete: ${proposal.id.substring(0, 8)}... (${deleteResponse.status})`);
        }
      } catch (error) {
        console.log(`  ❌ Error deleting: ${proposal.id.substring(0, 8)}... (${error.message})`);
      }
    }
  }

  // Fix author IDs for remaining proposals
  console.log(`\n👤 Fixing author IDs for ${authorsToFix.length} proposals...`);
  let fixedCount = 0;
  
  for (const { proposal, correctAuthor, originalAuthor } of authorsToFix) {
    try {
      const updateResponse = await makeRequest(
        `${API_BASE}/proposals/${proposal.id}`, 
        'PATCH',
        { authorId: correctAuthor.id }
      );
      
      if (updateResponse.status === 200) {
        console.log(`  ✅ ${proposal.title.substring(0, 50)}...`);
        console.log(`     👤 ${originalAuthor} -> ${correctAuthor.id} (${correctAuthor.method})`);
        fixedCount++;
      } else {
        console.log(`  ❌ Failed to fix: ${proposal.title.substring(0, 50)}... (${updateResponse.status})`);
      }
    } catch (error) {
      console.log(`  ❌ Error fixing: ${proposal.title.substring(0, 50)}... (${error.message})`);
    }
  }

  // Get final statistics
  console.log('\n📊 Getting final statistics...');
  const finalStatsResponse = await makeRequest(`${API_BASE}/proposals/statistics`);
  const finalStats = finalStatsResponse.data;

  console.log('\n' + '=' .repeat(60));
  console.log('🎯 CLEANING & FIXING SUMMARY');
  console.log('=' .repeat(60));
  console.log(`🗑️  Duplicates deleted: ${deletedCount}`);
  console.log(`👤 Authors fixed: ${fixedCount}`);
  console.log(`📝 Final proposal count: ${finalStats.total}`);
  console.log(`📊 By Status: ${JSON.stringify(finalStats.byStatus, null, 2)}`);
  console.log(`🏷️  By Type: ${JSON.stringify(finalStats.byType, null, 2)}`);
  
  // Check remaining temp authors
  const remainingResponse = await makeRequest(`${API_BASE}/proposals?limit=200`);
  const remaining = remainingResponse.data.items || [];
  const tempAuthors = remaining.filter(p => p.authorId === 'temp-agent-id');
  
  if (tempAuthors.length > 0) {
    console.log(`\n⚠️  Remaining temp authors: ${tempAuthors.length}`);
    tempAuthors.slice(0, 5).forEach(p => {
      console.log(`  📝 ${p.title.substring(0, 60)}...`);
    });
  } else {
    console.log(`\n🎉 All proposals now have proper authors!`);
  }

  console.log('\n🎉 Cleaning and fixing completed!');
  console.log(`🌐 Access clean system at: ${API_BASE.replace('/api', '')}`);
}

if (require.main === module) {
  cleanAndFixProposals().catch(console.error);
}

module.exports = { cleanAndFixProposals };
