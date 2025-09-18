#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');

// Simple HTTP client
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

// Extract unique proposal ID from filename or content
function extractProposalId(filename, content) {
  // Try filename first
  const filenameMatch = filename.match(/^(\d{3}|BIP-\d{2}-\d{3}|P\d{3})/);
  if (filenameMatch) {
    return filenameMatch[1];
  }
  
  // Try content
  const contentMatch = content.match(/^#+\s*(?:🤖\s*)?(\d{3}|BIP-\d{2}-\d{3}|P\d{3})/m);
  if (contentMatch) {
    return contentMatch[1];
  }
  
  // Generate from filename without extension
  return filename.replace('.md', '').replace(/[^a-zA-Z0-9-]/g, '-');
}

// Create unique fingerprint for proposal
function createProposalFingerprint(title, proposalId) {
  const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${proposalId}-${normalizedTitle.substring(0, 20)}`;
}

// Check if proposal already exists
async function proposalExists(fingerprint, title) {
  try {
    // Search by title similarity
    const searchResponse = await makeRequest(`${API_BASE}/proposals/search?q=${encodeURIComponent(title)}`);
    
    if (searchResponse.status === 200 && searchResponse.data.items) {
      const existing = searchResponse.data.items.find(p => 
        createProposalFingerprint(p.title, extractProposalId('', p.title)) === fingerprint
      );
      
      return existing || null;
    }
    
    return null;
  } catch (error) {
    console.log(`    ⚠️ Error checking existence: ${error.message}`);
    return null;
  }
}

async function smartProposalMigration() {
  console.log('🧠 HiveLLM Smart Proposal Migration');
  console.log('🎯 Only creates proposals that don\'t exist yet');
  console.log(`📁 Gov path: ${GOV_PATH}`);
  console.log(`🌐 API URL: ${API_BASE}\n`);

  // Test API connection
  try {
    const response = await makeRequest(`${API_BASE}/governance/health`);
    console.log(`✅ API connected: ${response.data.status}\n`);
  } catch (error) {
    console.error('❌ API connection failed:', error.message);
    process.exit(1);
  }

  // Get existing agents for author mapping
  console.log('🤖 Loading agents for author mapping...');
  const agentsResponse = await makeRequest(`${API_BASE}/agents?limit=100`);
  const agents = agentsResponse.data.items || [];
  console.log(`📊 Found ${agents.length} agents\n`);

  // Create author mapping
  const authorMap = {};
  agents.forEach(agent => {
    const normalizedName = agent.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    authorMap[normalizedName] = agent.id;
    
    if (agent.organization) {
      authorMap[agent.organization.toLowerCase()] = agent.id;
    }
    
    // Model-specific mappings
    if (agent.name.includes('Claude')) {
      authorMap['claude'] = agent.id;
      authorMap['anthropic'] = agent.id;
    }
    if (agent.name.includes('GPT')) {
      authorMap['gpt'] = agent.id;
      authorMap['openai'] = agent.id;
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

  // Get existing proposals to build fingerprint cache
  console.log('📋 Loading existing proposals...');
  const existingResponse = await makeRequest(`${API_BASE}/proposals?limit=200`);
  const existing = existingResponse.data.items || [];
  console.log(`📊 Found ${existing.length} existing proposals\n`);

  const existingFingerprints = new Set();
  existing.forEach(p => {
    const proposalId = extractProposalId('', p.title);
    const fingerprint = createProposalFingerprint(p.title, proposalId);
    existingFingerprints.add(fingerprint);
  });

  // Helper function to find correct authorId
  function findAuthorId(authorString, title) {
    if (!authorString) return null;
    
    const searchText = (authorString + ' ' + title).toLowerCase();
    const normalized = authorString.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Direct match
    if (authorMap[normalized]) {
      return authorMap[normalized];
    }
    
    // Partial matches
    for (const [key, agentId] of Object.entries(authorMap)) {
      if (key.length > 3 && (normalized.includes(key) || key.includes(normalized))) {
        return agentId;
      }
    }
    
    // Context-based matching
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
        if (agent) return agent.id;
      }
    }
    
    return null;
  }

  // Process proposals directory
  const proposalsPath = path.join(GOV_PATH, 'proposals');
  const directories = fs.readdirSync(proposalsPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  const STATUS_MAP = {
    'approved': 'approved',
    'implemented': 'implemented', 
    'in-implementation': 'in-implementation',
    'pending': 'discussion',
    'rejected': 'rejected',
    'consolidated-archive': 'archived'
  };

  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const dir of directories) {
    if (dir === 'consolidated' || dir === 'originals') {
      console.log(`⏭️  Skipping ${dir} (metadata only)`);
      continue;
    }

    const dirPath = path.join(proposalsPath, dir);
    const status = STATUS_MAP[dir] || 'discussion';
    
    console.log(`📁 Processing ${dir}/ (status: ${status})`);

    const files = fs.readdirSync(dirPath)
      .filter(file => file.endsWith('.md') && 
                     !file.includes('README') && 
                     !file.includes('TEMPLATE') &&
                     !file.includes('INDEX') &&
                     !file.includes('.bak'));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Extract title from first heading
        const titleMatch = content.match(/^# (.+)$/m);
        if (!titleMatch) {
          console.log(`  ⚠️  Skipping ${file} (no title found)`);
          skipped++;
          continue;
        }
        
        const title = titleMatch[1].replace(/^🤖\s*/, '').trim();
        const proposalId = extractProposalId(file, content);
        const fingerprint = createProposalFingerprint(title, proposalId);
        
        // Check if already exists
        if (existingFingerprints.has(fingerprint)) {
          console.log(`  ⏭️  [SKIP] ${title} (already exists)`);
          skipped++;
          continue;
        }

        // Extract metadata
        const metadata = { author: null };
        const authorMatch = content.match(/\*\*Author\*\*:\s*(.+)/);
        if (authorMatch) {
          metadata.author = authorMatch[1].trim();
        }

        // Find correct author
        const authorId = findAuthorId(metadata.author, title);

        // Extract sections for proper DTO structure
        const abstractMatch = content.match(/## Abstract\s*\n([\s\S]*?)(?=\n## |\n# |$)/);
        const motivationMatch = content.match(/## Motivation\s*\n([\s\S]*?)(?=\n## |\n# |$)/);
        const specificationMatch = content.match(/## Specification\s*\n([\s\S]*?)(?=\n## |\n# |$)/);

        const proposalData = {
          title: title,
          type: 'standards', // Default type
          content: {
            abstract: abstractMatch ? abstractMatch[1].trim().substring(0, 450) : `${title}. Historical proposal from governance archive.`,
            motivation: motivationMatch ? motivationMatch[1].trim().substring(0, 1900) : "This proposal was part of the HiveLLM governance process and represents historical decision-making.",
            specification: specificationMatch ? specificationMatch[1].trim().substring(0, 9000) : `${content.substring(0, 8000)}${content.length > 8000 ? '...' : ''}`
          },
          metadata: {
            author_github: metadata.author,
            category: ['Core', dir],
            original_id: proposalId,
            fingerprint: fingerprint
          }
        };

        // Create proposal
        const response = await makeRequest(`${API_BASE}/proposals`, 'POST', proposalData);
        
        if (response.status === 201) {
          const authorInfo = authorId ? `✅ (${authorId.substring(0, 8)}...)` : '⚠️ (no author)';
          console.log(`  ✅ [NEW] ${title} ${authorInfo}`);
          
          // If we have a correct author but proposal was created with temp-agent-id, update it
          if (authorId && response.data.authorId === 'temp-agent-id') {
            try {
              const updateResponse = await makeRequest(
                `${API_BASE}/proposals/${response.data.id}`,
                'PATCH',
                { authorId: authorId }
              );
              
              if (updateResponse.status === 200) {
                console.log(`    👤 Author updated: temp-agent-id -> ${authorId.substring(0, 8)}...`);
                updated++;
              }
            } catch (error) {
              console.log(`    ⚠️ Could not update author: ${error.message}`);
            }
          }
          
          created++;
          existingFingerprints.add(fingerprint); // Update cache
        } else {
          console.log(`  ❌ Failed: ${title} (${response.status})`);
          if (response.data?.message) {
            console.log(`     Error: ${JSON.stringify(response.data.message).substring(0, 100)}...`);
          }
          skipped++;
        }

      } catch (error) {
        console.log(`  ❌ Error processing ${file}: ${error.message}`);
        skipped++;
      }
    }
    
    console.log(`  📊 ${dir}: ${files.length} files processed\n`);
  }

  // Final statistics
  console.log('=' .repeat(60));
  console.log('🎯 SMART MIGRATION SUMMARY');
  console.log('=' .repeat(60));
  console.log(`✅ New proposals created: ${created}`);
  console.log(`👤 Author IDs updated: ${updated}`);
  console.log(`⏭️  Proposals skipped (existing): ${skipped}`);
  
  // Get updated system statistics
  try {
    const finalStatsResponse = await makeRequest(`${API_BASE}/proposals/statistics`);
    const finalStats = finalStatsResponse.data;
    
    console.log('\n📈 Final System Statistics:');
    console.log(`📝 Total Proposals: ${finalStats.total}`);
    console.log(`📊 By Status: ${JSON.stringify(finalStats.byStatus, null, 2)}`);
    console.log(`🏷️  By Type: ${JSON.stringify(finalStats.byType, null, 2)}`);
    
  } catch (error) {
    console.log('⚠️  Could not fetch final statistics');
  }

  console.log('\n🎉 Smart migration completed!');
  console.log(`🌐 Access system at: ${API_BASE.replace('/api', '')}`);
}

if (require.main === module) {
  smartProposalMigration().catch(console.error);
}

module.exports = { smartProposalMigration };
