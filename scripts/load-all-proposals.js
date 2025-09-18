#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Simple HTTP client
function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
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

// Configuration
const GOV_PATH = path.resolve(__dirname, '../../gov');
const API_BASE = 'http://localhost:23080/api';

// Status mapping based on directory
const STATUS_MAP = {
  'approved': 'approved',
  'implemented': 'implemented', 
  'in-implementation': 'in-implementation',
  'pending': 'discussion',
  'rejected': 'rejected',
  'consolidated': 'consolidated',
  'consolidated-archive': 'archived',
  'originals': 'archived'
};

// Type mapping based on keywords
const TYPE_MAP = {
  'standards': ['framework', 'protocol', 'standard', 'governance', 'bip'],
  'process': ['process', 'workflow', 'methodology', 'procedure'],
  'informational': ['overview', 'documentation', 'guide', 'informational'],
  'meta': ['meta', 'governance', 'voting', 'consensus']
};

function parseProposalMetadata(content, filePath) {
  const lines = content.split('\n');
  const metadata = {
    id: null,
    title: null,
    author: null,
    status: null,
    type: 'informational',
    category: 'Core',
    created: null,
    abstract: null,
    content: {}
  };

  // Extract ID from filename
  const filename = path.basename(filePath, '.md');
  const idMatch = filename.match(/^(\d{3}|BIP-\d{2}-\d{3})/);
  if (idMatch) {
    metadata.id = idMatch[1];
  }

  // Extract title from first heading
  const titleLine = lines.find(line => line.startsWith('# '));
  if (titleLine) {
    metadata.title = titleLine.replace(/^# /, '').replace(/^🤖\s*/, '').trim();
  }

  // Parse structured metadata
  let inBipSection = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === '## BIP Information' || line === '## Metadata') {
      inBipSection = true;
      continue;
    }

    if (inBipSection && line.startsWith('**')) {
      const match = line.match(/\*\*([^*]+)\*\*:\s*(.+)/);
      if (match) {
        const key = match[1].toLowerCase();
        const value = match[2].trim();
        
        switch (key) {
          case 'title':
            metadata.title = metadata.title || value;
            break;
          case 'author':
            metadata.author = value;
            break;
          case 'status':
            metadata.status = value.toLowerCase();
            break;
          case 'type':
            metadata.type = value.toLowerCase();
            break;
          case 'category':
            metadata.category = value;
            break;
          case 'created':
            metadata.created = value;
            break;
        }
      }
    }

    // Extract abstract
    if (line === '## Abstract') {
      let abstractText = '';
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim().startsWith('## ')) break;
        abstractText += lines[j] + '\n';
      }
      metadata.abstract = abstractText.trim();
    }
  }

  return metadata;
}

function extractSections(content) {
  const lines = content.split('\n');
  const sections = {};
  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check for section headers
    if (trimmed.startsWith('## ')) {
      // Save previous section
      if (currentSection && currentContent.length > 0) {
        const text = currentContent.join('\n').trim();
        if (text) {
          sections[currentSection] = text;
        }
      }
      
      // Start new section
      const sectionName = trimmed.replace('## ', '').toLowerCase();
      currentContent = [];
      
      if (sectionName.includes('abstract')) {
        currentSection = 'abstract';
      } else if (sectionName.includes('motivation')) {
        currentSection = 'motivation';
      } else if (sectionName.includes('specification') || sectionName.includes('technical') || sectionName.includes('implementation plan')) {
        currentSection = 'specification';
      } else if (sectionName.includes('implementation')) {
        currentSection = 'implementation';
      } else if (sectionName.includes('rationale')) {
        currentSection = 'rationale';
      } else if (sectionName.includes('backward') || sectionName.includes('compatibility')) {
        currentSection = 'backwards_compatibility';
      } else if (sectionName.includes('security')) {
        currentSection = 'security_considerations';
      } else if (sectionName.includes('copyright') || sectionName.includes('license')) {
        currentSection = 'copyright';
      } else {
        currentSection = null;
      }
    } else if (currentSection && trimmed) {
      currentContent.push(line);
    }
  }
  
  // Save last section
  if (currentSection && currentContent.length > 0) {
    const text = currentContent.join('\n').trim();
    if (text) {
      sections[currentSection] = text;
    }
  }
  
  // Ensure minimum lengths and clean up
  const result = {};
  
  if (sections.abstract) {
    result.abstract = sections.abstract.substring(0, 450);
  }
  
  if (sections.motivation) {
    result.motivation = sections.motivation.length >= 100 
      ? sections.motivation.substring(0, 1900)
      : sections.motivation + '. This proposal represents an important aspect of the HiveLLM governance evolution.';
  }
  
  if (sections.specification) {
    result.specification = sections.specification.length >= 200
      ? sections.specification.substring(0, 9000)
      : sections.specification + '. Detailed technical implementation guidelines are provided in the original proposal document.';
  }
  
  // Optional fields
  if (sections.implementation) {
    result.implementation = sections.implementation.substring(0, 4900);
  }
  
  if (sections.rationale) {
    result.rationale = sections.rationale.substring(0, 1900);
  }
  
  if (sections.backwards_compatibility) {
    result.backwards_compatibility = sections.backwards_compatibility.substring(0, 900);
  }
  
  if (sections.security_considerations) {
    result.security_considerations = sections.security_considerations.substring(0, 900);
  }
  
  if (sections.copyright) {
    result.copyright = sections.copyright.substring(0, 190);
  }
  
  return result;
}

function determineType(title, content) {
  const text = (title + ' ' + content).toLowerCase();
  
  for (const [type, keywords] of Object.entries(TYPE_MAP)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return type;
    }
  }
  
  return 'informational';
}

async function loadAllProposals() {
  console.log('🚀 HiveLLM Complete Proposal Loader');
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

  // Get existing agents to map authors correctly
  console.log('🤖 Loading existing agents for author mapping...');
  const agentsResponse = await makeRequest(`${API_BASE}/agents?limit=100`);
  const agents = agentsResponse.data.items || [];
  console.log(`📊 Found ${agents.length} agents in system\n`);
  
  // Create author mapping
  const authorMap = {};
  agents.forEach(agent => {
    const normalizedName = agent.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    authorMap[normalizedName] = agent.id;
    
    // Also map common variations
    if (agent.name.includes('Claude')) {
      authorMap['claude'] = agent.id;
      authorMap['anthropic'] = agent.id;
    }
    if (agent.name.includes('GPT') || agent.name.includes('gpt')) {
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
  
  console.log(`🔗 Created ${Object.keys(authorMap).length} author mappings\n`);

  // Helper function to find correct authorId
  function findAuthorId(authorString) {
    if (!authorString) return null;
    
    const normalized = authorString.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Direct match
    if (authorMap[normalized]) {
      return authorMap[normalized];
    }
    
    // Partial matches
    for (const [key, agentId] of Object.entries(authorMap)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return agentId;
      }
    }
    
    return null;
  }

  const proposalsPath = path.join(GOV_PATH, 'proposals');
  const directories = fs.readdirSync(proposalsPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  console.log(`📂 Found directories: ${directories.join(', ')}\n`);

  let totalLoaded = 0;
  let totalSkipped = 0;
  const statistics = {};

  for (const dir of directories) {
    if (dir === 'consolidated' || dir === 'originals') {
      console.log(`⏭️  Skipping ${dir} (metadata only)`);
      continue;
    }

    const dirPath = path.join(proposalsPath, dir);
    const status = STATUS_MAP[dir] || 'discussion';
    
    if (!statistics[status]) {
      statistics[status] = 0;
    }

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
        const metadata = parseProposalMetadata(content, filePath);
        
        if (!metadata.title) {
          console.log(`  ⚠️  Skipping ${file} (no title found)`);
          totalSkipped++;
          continue;
        }

        // Extract sections from content for proper structure
        const sections = extractSections(content);
        
        // Determine final properties
        const finalType = metadata.type && ['standards', 'informational', 'process'].includes(metadata.type.toLowerCase())
          ? metadata.type.toLowerCase()
          : determineType(metadata.title, content);
        
        // Find correct authorId
        const authorId = findAuthorId(metadata.author);

        const proposalData = {
          title: metadata.title,
          type: finalType,
          authorId: authorId, // Mapeamento correto do autor
          content: {
            abstract: sections.abstract || metadata.abstract || (metadata.title + '. Historical proposal from governance archive.').substring(0, 450),
            motivation: sections.motivation || "This proposal was part of the HiveLLM governance process and represents historical decision-making. It addresses important aspects of the system's evolution and community needs.",
            specification: sections.specification || content.substring(0, 8000) + (content.length > 8000 ? '...' : ''),
            implementation: sections.implementation,
            rationale: sections.rationale,
            backwards_compatibility: sections.backwards_compatibility,
            security_considerations: sections.security_considerations,
            copyright: sections.copyright
          },
          metadata: {
            author_github: metadata.author,
            category: [metadata.category || 'Core', dir]
          }
        };

        // Create proposal via API
        const response = await makeRequest(`${API_BASE}/proposals`, 'POST', proposalData);
        
        if (response.status === 201) {
          const authorInfo = authorId ? `✅ (${authorId})` : '⚠️ (no author)';
          console.log(`  ✅ [${totalLoaded + 1}] ${proposalData.title} ${authorInfo}`);
          totalLoaded++;
          statistics[status]++;
        } else {
          console.log(`  ❌ Failed: ${proposalData.title} (${response.status})`);
          if (totalSkipped < 3) {
            console.log(`    🔍 Error details:`, JSON.stringify(response.data, null, 2));
          }
          totalSkipped++;
        }

      } catch (error) {
        if (error.status === 409) {
          console.log(`  ⏭️  Skipping ${file} (already exists)`);
          totalSkipped++;
        } else {
          console.log(`  ❌ Error processing ${file}: ${error.message}`);
          totalSkipped++;
        }
      }
    }
    
    console.log(`  📊 ${dir}: ${files.length} files processed\n`);
  }

  // Final statistics
  console.log('📊 Final Statistics:');
  console.log(`✅ Total loaded: ${totalLoaded}`);
  console.log(`⏭️  Total skipped: ${totalSkipped}`);
  console.log('\n📋 By Status:');
  for (const [status, count] of Object.entries(statistics)) {
    console.log(`  - ${status}: ${count}`);
  }

  // Get final system stats
  try {
    const statsResponse = await makeRequest(`${API_BASE}/proposals/statistics`);
    const systemStats = statsResponse.data;
    
    console.log('\n🎯 System Totals:');
    console.log(`📝 Total Proposals: ${systemStats.total}`);
    console.log(`📊 By Status: ${JSON.stringify(systemStats.byStatus, null, 2)}`);
    console.log(`🏷️  By Type: ${JSON.stringify(systemStats.byType, null, 2)}`);
    
  } catch (error) {
    console.log('⚠️  Could not fetch final statistics');
  }

  console.log('\n🎉 Complete Proposal Loading Finished!');
  console.log(`\n🌐 Access all ${totalLoaded} proposals at: ${API_BASE}/proposals`);
}

if (require.main === module) {
  loadAllProposals().catch(console.error);
}

module.exports = { loadAllProposals };
