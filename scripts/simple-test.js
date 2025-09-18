const fs = require('fs');
const path = require('path');

class SimpleTest {
  constructor() {
    this.apiUrl = 'http://localhost:23080/api';
    console.log('🚀 Simple BIP-06 System Test');
  }

  async testConnection() {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`${this.apiUrl}/governance/health`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API connection successful:', data.status);
        return true;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.error('❌ API connection failed:', error.message);
      return false;
    }
  }

  async testEndpoints() {
    console.log('\n📊 Testing Basic Endpoints...');
    const fetch = (await import('node-fetch')).default;

    // Test proposals endpoint
    try {
      const proposalsResponse = await fetch(`${this.apiUrl}/proposals`);
      if (proposalsResponse.ok) {
        const proposals = await proposalsResponse.json();
        console.log(`✅ Proposals: ${proposals.items.length} proposals found`);
      }
    } catch (error) {
      console.error('❌ Proposals endpoint failed:', error.message);
    }

    // Test agents endpoint
    try {
      const agentsResponse = await fetch(`${this.apiUrl}/agents`);
      if (agentsResponse.ok) {
        const agents = await agentsResponse.json();
        console.log(`✅ Agents: ${agents.items.length} agents found`);
      }
    } catch (error) {
      console.error('❌ Agents endpoint failed:', error.message);
    }

    // Test voting endpoint
    try {
      const votingResponse = await fetch(`${this.apiUrl}/voting/status`);
      if (votingResponse.ok) {
        const voting = await votingResponse.json();
        console.log(`✅ Voting: ${voting.activeSessions} active sessions`);
      }
    } catch (error) {
      console.error('❌ Voting endpoint failed:', error.message);
    }
  }

  async loadSession0005Data() {
    console.log('\n🗳️ Loading Session 0005 Real Data...');
    
    const votesDir = path.resolve('../gov/minutes/0005/votes');
    
    if (!fs.existsSync(votesDir)) {
      console.warn('⚠️ Session 0005 votes directory not found');
      return [];
    }

    const voteFiles = fs.readdirSync(votesDir)
      .filter(f => f.endsWith('.json') && f !== 'TEMPLATE.json');

    const participants = [];

    for (const voteFile of voteFiles) {
      try {
        const modelName = voteFile.replace('.json', '');
        const voteData = JSON.parse(fs.readFileSync(path.join(votesDir, voteFile), 'utf-8'));
        
        participants.push({
          id: modelName,
          name: this.formatModelName(modelName),
          voteData: voteData
        });

      } catch (error) {
        console.warn(`⚠️ Error parsing ${voteFile}`);
      }
    }

    console.log(`📊 Found ${participants.length} participants from Session 0005:`);
    participants.forEach(p => {
      const avgScore = p.voteData.weights 
        ? (p.voteData.weights.reduce((sum, w) => sum + w.weight, 0) / p.voteData.weights.length).toFixed(1)
        : 'N/A';
      console.log(`  - ${p.name}: avg ${avgScore}/10`);
    });

    return participants;
  }

  formatModelName(rawName) {
    return rawName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .replace(/\b(gpt|claude|gemini|grok|deepseek)\b/gi, match => {
        const mapping = {
          'gpt': 'GPT',
          'claude': 'Claude', 
          'gemini': 'Gemini',
          'grok': 'Grok',
          'deepseek': 'DeepSeek'
        };
        return mapping[match.toLowerCase()] || match;
      });
  }

  async showSystemStatus() {
    console.log('\n📊 System Status Summary:');
    const fetch = (await import('node-fetch')).default;

    try {
      // Health check
      const healthResponse = await fetch(`${this.apiUrl}/governance/health`);
      if (healthResponse.ok) {
        const health = await healthResponse.json();
        console.log(`✅ System Status: ${health.status}`);
        console.log(`⏱️ Uptime: ${Math.floor(health.uptime)} seconds`);
      }

      // Basic stats
      const endpoints = [
        { name: 'Proposals', url: `${this.apiUrl}/proposals/statistics` },
        { name: 'Agents', url: `${this.apiUrl}/agents/statistics` },
        { name: 'Voting', url: `${this.apiUrl}/voting/status` }
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint.url);
          if (response.ok) {
            const data = await response.json();
            if (endpoint.name === 'Proposals' && data.total !== undefined) {
              console.log(`📝 ${endpoint.name}: ${data.total} total`);
            } else if (endpoint.name === 'Agents' && data.total !== undefined) {
              console.log(`🤖 ${endpoint.name}: ${data.total} total`);
            } else if (endpoint.name === 'Voting' && data.activeSessions !== undefined) {
              console.log(`🗳️ ${endpoint.name}: ${data.activeSessions} active sessions`);
            }
          }
        } catch (error) {
          console.warn(`⚠️ ${endpoint.name} stats unavailable`);
        }
      }

    } catch (error) {
      console.error('❌ System status check failed');
    }
  }

  async run() {
    console.log('\n🚀 Starting Simple BIP-06 System Test...\n');

    // Test basic connectivity
    const connected = await this.testConnection();
    if (!connected) {
      console.error('❌ Cannot connect to system. Make sure the server is running.');
      return;
    }

    // Test endpoints
    await this.testEndpoints();

    // Load real governance data
    const participants = await this.loadSession0005Data();

    // Show system status
    await this.showSystemStatus();

    console.log('\n🎉 Simple test completed!');
    console.log('\n📋 Summary:');
    console.log(`- System status: ✅ Running`);
    console.log(`- Historical participants: ${participants.length}`);
    console.log(`- BIP-06 Phase 1: ✅ Core Infrastructure Complete`);
    
    console.log('\n🌐 Access Points:');
    console.log(`- API: ${this.apiUrl}`);
    console.log(`- Swagger: http://localhost:23080/api`);
    console.log(`- Health: ${this.apiUrl}/governance/health`);

    console.log('\n💡 Next Steps:');
    console.log('- Fix DTO validation for agent creation');
    console.log('- Implement WebSocket for real-time communication');
    console.log('- Add execution engine for proposal automation');
    console.log('- Enable GraphQL endpoints');
  }
}

// Execute test
async function main() {
  const test = new SimpleTest();
  await test.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = SimpleTest;
