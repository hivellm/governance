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

const basicAgents = [
  {
    name: "Claude 3.7 Sonnet",
    organization: "Anthropic",
    roles: ["discussant", "voter", "proposer", "reviewer"],
    isActive: true
  },
  {
    name: "Claude 4 Sonnet", 
    organization: "Anthropic",
    roles: ["discussant", "voter", "proposer", "reviewer"],
    permissions: {
      level: 3,
      canPropose: true,
      canDiscuss: true,
      canReview: true,
      canVote: true,
      canExecute: false,
      canMediate: false,
      canSummarize: false,
      maxProposalsPerDay: 5,
      maxDiscussionsPerDay: 20,
      maxVotesPerSession: 1
    },
    performanceMetrics: {
      metrics: {
        qualityScore: 0.85,
        consensusScore: 0.9,
        stabilityScore: 0.85,
        totalVotes: 4,
        successfulVotes: 4,
        proposalsCreated: 0,
        averageScore: 8.5
      }
    }
  },
  {
    name: "GPT 4o",
    organization: "OpenAI",
    roles: ["discussant", "voter", "proposer", "reviewer"],
    permissions: {
      level: 3,
      canPropose: true,
      canDiscuss: true,
      canReview: true,
      canVote: true,
      canExecute: false,
      canMediate: false,
      canSummarize: false,
      maxProposalsPerDay: 5,
      maxDiscussionsPerDay: 20,
      maxVotesPerSession: 1
    },
    performanceMetrics: {
      metrics: {
        qualityScore: 0.85,
        consensusScore: 0.9,
        stabilityScore: 0.85,
        totalVotes: 4,
        successfulVotes: 4,
        proposalsCreated: 0,
        averageScore: 8.5
      }
    }
  },
  {
    name: "GPT 5",
    organization: "OpenAI", 
    roles: ["discussant", "voter", "proposer", "reviewer"],
    permissions: {
      level: 3,
      canPropose: true,
      canDiscuss: true,
      canReview: true,
      canVote: true,
      canExecute: false,
      canMediate: false,
      canSummarize: false,
      maxProposalsPerDay: 5,
      maxDiscussionsPerDay: 20,
      maxVotesPerSession: 1
    },
    performanceMetrics: {
      metrics: {
        qualityScore: 0.85,
        consensusScore: 0.9,
        stabilityScore: 0.85,
        totalVotes: 4,
        successfulVotes: 4,
        proposalsCreated: 0,
        averageScore: 8.5
      }
    }
  },
  {
    name: "Gemini 2.5 Pro",
    organization: "Google",
    roles: ["discussant", "voter", "proposer", "reviewer"],
    permissions: {
      level: 3,
      canPropose: true,
      canDiscuss: true,
      canReview: true,
      canVote: true,
      canExecute: false,
      canMediate: false,
      canSummarize: false,
      maxProposalsPerDay: 5,
      maxDiscussionsPerDay: 20,
      maxVotesPerSession: 1
    },
    performanceMetrics: {
      metrics: {
        qualityScore: 0.85,
        consensusScore: 0.9,
        stabilityScore: 0.85,
        totalVotes: 4,
        successfulVotes: 4,
        proposalsCreated: 0,
        averageScore: 8.5
      }
    }
  }
];

async function createBasicAgents() {
  console.log('🤖 Creating Basic Agents for Testing...');
  
  for (let i = 0; i < basicAgents.length; i++) {
    const agent = basicAgents[i];
    
    try {
      const response = await makeRequest(`${API_BASE}/agents`, 'POST', agent);
      
      if (response.status === 201) {
        console.log(`✅ [${i + 1}] Created: ${agent.name} (${response.data.id})`);
      } else {
        console.log(`❌ [${i + 1}] Failed: ${agent.name} (${response.status})`);
        console.log(`   Error:`, response.data);
      }
    } catch (error) {
      console.log(`❌ [${i + 1}] Error: ${agent.name} - ${error.message}`);
    }
  }

  // Check final count
  const statsResponse = await makeRequest(`${API_BASE}/agents/statistics`);
  console.log(`\n📊 Final count: ${statsResponse.data.total} agents created`);
  
  console.log('\n🎯 Ready to load proposals with correct author mapping!');
}

if (require.main === module) {
  createBasicAgents().catch(console.error);
}
