const fs = require('fs');
const path = require('path');

class GovernanceMigrator {
  constructor() {
    this.apiUrl = 'http://localhost:23080/api';
    this.govPath = path.resolve('../gov');
    console.log('🚀 HiveLLM Governance Data Migrator');
    console.log(`📁 Governance path: ${this.govPath}`);
    console.log(`🌐 API URL: ${this.apiUrl}`);
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

  loadModelEvaluations() {
    const metricsPath = path.join(this.govPath, 'metrics/model_evaluations.json');
    
    if (!fs.existsSync(metricsPath)) {
      console.warn('⚠️ Model evaluations file not found');
      return [];
    }

    try {
      const data = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
      console.log(`📊 Loaded ${data.evaluations.length} model evaluations`);
      return data.evaluations.slice(0, 10); // Limit to first 10 for testing
    } catch (error) {
      console.error('❌ Error loading model evaluations:', error);
      return [];
    }
  }

  async migrateAgents(evaluations) {
    console.log('\n🤖 Migrating Agents...');
    const fetch = (await import('node-fetch')).default;

    for (const [index, evaluation] of evaluations.entries()) {
      try {
        const agentId = this.formatAgentId(evaluation.fullModel);
        const agent = {
          id: agentId,
          name: evaluation.fullModel,
          organization: evaluation.provider,
          roles: this.determineRoles(evaluation)
        };

        const response = await fetch(`${this.apiUrl}/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agent)
        });

        if (response.ok) {
          // Update performance metrics
          const metrics = this.calculatePerformanceMetrics(evaluation);
          await this.updateAgentMetrics(agentId, metrics);
          console.log(`✅ [${index + 1}/${evaluations.length}] Migrated agent: ${agent.name}`);
        } else {
          const error = await response.text();
          if (error.includes('already exists')) {
            console.log(`⚡ [${index + 1}/${evaluations.length}] Agent exists: ${agent.name}`);
          } else {
            console.warn(`⚠️ Failed to create agent ${agent.name}: ${error}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error migrating agent ${evaluation.fullModel}:`, error.message);
      }
    }
  }

  formatAgentId(fullModel) {
    return fullModel.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  determineRoles(evaluation) {
    const roles = ['discussant', 'voter'];
    
    if (evaluation.status === 'general') {
      roles.push('proposer');
    }
    
    if (evaluation.score > 85) {
      roles.push('reviewer');
    }
    
    if (evaluation.score > 90 && evaluation.status === 'general') {
      roles.push('mediator', 'executor');
    }

    return roles;
  }

  calculatePerformanceMetrics(evaluation) {
    const qualityScore = evaluation.score / 100;
    const consensusScore = evaluation.status === 'general' ? 0.8 : 0.6;
    const stabilityCheck = evaluation.checks?.find(c => c.name === 'Stability');
    const stabilityScore = stabilityCheck ? stabilityCheck.score / 10 : 0.7;

    return {
      qualityScore,
      consensusScore,
      stabilityScore,
      totalVotes: Math.floor(Math.random() * 50), // Simulate historical votes
      successfulVotes: Math.floor(Math.random() * 40),
      proposalsCreated: evaluation.status === 'general' ? Math.floor(Math.random() * 10) : 0,
      averageScore: evaluation.score / 10
    };
  }

  async updateAgentMetrics(agentId, metrics) {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`${this.apiUrl}/agents/${agentId}/update-metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics })
      });
      
      if (!response.ok) {
        console.warn(`⚠️ Failed to update metrics for ${agentId}`);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to update metrics for ${agentId}:`, error.message);
    }
  }

  async createTestProposals() {
    console.log('\n📝 Creating Test Proposals...');
    const fetch = (await import('node-fetch')).default;

    const testProposals = [
      {
        title: 'Enhanced Multi-Agent Coordination Framework',
        type: 'standards',
        content: {
          abstract: 'Advanced coordination system for multi-agent governance enabling better collaboration and decision-making across the HiveLLM ecosystem.',
          motivation: 'Current governance lacks structured coordination mechanisms between agents, leading to inefficiencies and suboptimal decision-making. This proposal addresses the need for systematic agent coordination.',
          specification: 'The framework includes: 1) Structured communication protocols for inter-agent messaging, 2) Role-based permission system with hierarchical access control, 3) Automated workflow management with state transitions, 4) Consensus-building mechanisms for complex decisions, 5) Real-time coordination monitoring and metrics.',
          implementation: 'Implementation will be phased over 8 weeks with initial protocol setup, followed by permission system integration, and finally workflow automation deployment.'
        }
      },
      {
        title: 'Real-time Voting Transparency Dashboard',
        type: 'process',
        content: {
          abstract: 'Comprehensive dashboard for real-time monitoring of voting activities with live tracking and transparency metrics.',
          motivation: 'Stakeholders need immediate visibility into governance processes to ensure accountability and trust. Current voting mechanisms lack real-time transparency.',
          specification: 'Dashboard features: 1) Live vote tracking with real-time updates, 2) Consensus visualization with weighted vote display, 3) Transparency metrics showing participation rates, 4) Historical voting patterns and trends, 5) Mobile-responsive interface for accessibility.',
          implementation: 'Built using React with WebSocket integration for real-time updates. Backend API provides voting data with appropriate access controls.'
        }
      },
      {
        title: 'AI Model Performance Evaluation Protocol',
        type: 'standards',
        content: {
          abstract: 'Standardized protocol for evaluating AI model performance in governance contexts with objective metrics.',
          motivation: 'Governance quality depends on participating model performance. We need consistent evaluation criteria to maintain system integrity and identify high-performing contributors.',
          specification: 'Protocol includes: 1) Decision quality metrics based on outcome tracking, 2) Consistency scoring across multiple decisions, 3) Collaborative effectiveness measures, 4) Response time and reliability tracking, 5) Peer review integration for subjective quality assessment.',
          implementation: 'Automated evaluation system with periodic assessment cycles, integrated reporting, and performance-based role assignments.'
        }
      }
    ];

    const createdProposals = [];

    for (const [index, proposal] of testProposals.entries()) {
      try {
        const response = await fetch(`${this.apiUrl}/proposals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(proposal)
        });

        if (response.ok) {
          const created = await response.json();
          createdProposals.push(created);
          console.log(`✅ [${index + 1}/${testProposals.length}] Created proposal: ${created.id}`);

          // Submit for discussion
          await fetch(`${this.apiUrl}/proposals/${created.id}/submit`, {
            method: 'POST'
          });
          
          console.log(`  📤 Submitted for discussion: ${created.id}`);
        } else {
          const error = await response.text();
          console.warn(`⚠️ Failed to create proposal: ${error}`);
        }
      } catch (error) {
        console.error(`❌ Error creating proposal:`, error.message);
      }
    }

    return createdProposals;
  }

  async testVotingSystem(proposals) {
    if (!proposals || proposals.length === 0) {
      console.log('⚠️ No proposals available for voting test');
      return;
    }

    console.log('\n🗳️ Testing Voting System...');
    const fetch = (await import('node-fetch')).default;

    // Test with the first proposal
    const proposal = proposals[0];
    
    try {
      // Initiate voting session
      const votingResponse = await fetch(`${this.apiUrl}/voting/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: proposal.id,
          config: {
            duration: 1, // 1 hour for testing
            quorumThreshold: 0.5,
            consensusThreshold: 0.6,
            autoFinalize: false,
            allowedRoles: ['voter', 'reviewer', 'mediator']
          }
        })
      });

      if (!votingResponse.ok) {
        const error = await votingResponse.text();
        console.error(`❌ Failed to initiate voting: ${error}`);
        return;
      }

      const votingSession = await votingResponse.json();
      console.log(`✅ Created voting session: ${votingSession.id}`);
      console.log(`📊 Eligible voters: ${votingSession.totalEligible}`);

      // Get available agents
      const agentsResponse = await fetch(`${this.apiUrl}/agents`);
      if (!agentsResponse.ok) return;

      const agentsData = await agentsResponse.json();
      const availableAgents = agentsData.items.slice(0, 5); // Test with first 5 agents

      // Cast some test votes
      console.log('\n🗳️ Casting test votes...');
      for (const [index, agent] of availableAgents.entries()) {
        try {
          const decision = Math.random() > 0.3 ? 'approve' : 
                          Math.random() > 0.5 ? 'abstain' : 'reject';
          
          const justification = `Vote from ${agent.name}: This proposal ${decision === 'approve' ? 'brings significant value' : decision === 'abstain' ? 'needs more consideration' : 'requires substantial changes'} to the governance system.`;

          const voteResponse = await fetch(`${this.apiUrl}/voting/${votingSession.id}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentId: agent.id,
              decision,
              justification
            })
          });

          if (voteResponse.ok) {
            const vote = await voteResponse.json();
            console.log(`  ✅ [${index + 1}/${availableAgents.length}] ${agent.name}: ${decision} (weight: ${vote.weight.toFixed(2)})`);
          } else {
            const error = await voteResponse.text();
            console.warn(`  ⚠️ Vote failed for ${agent.name}: ${error}`);
          }
        } catch (error) {
          console.error(`  ❌ Error casting vote for ${agent.name}:`, error.message);
        }
      }

      // Get final results
      console.log('\n📊 Getting voting results...');
      const resultsResponse = await fetch(`${this.apiUrl}/voting/${votingSession.id}/results`);
      if (resultsResponse.ok) {
        const results = await resultsResponse.json();
        console.log(`📈 Final Results:`);
        console.log(`  - Total votes: ${results.totalVotes}/${results.totalEligible}`);
        console.log(`  - Participation: ${(results.participationRate * 100).toFixed(1)}%`);
        console.log(`  - Consensus: ${results.consensus.percentage.toFixed(1)}% (threshold: ${results.consensus.threshold}%)`);
        console.log(`  - Quorum met: ${results.quorumMet ? '✅' : '❌'}`);
        console.log(`  - Result: ${results.result.toUpperCase()}`);
        console.log(`  - Approve: ${results.votes.approve.count} votes (${results.votes.approve.weight.toFixed(2)} weight)`);
        console.log(`  - Reject: ${results.votes.reject.count} votes (${results.votes.reject.weight.toFixed(2)} weight)`);
        console.log(`  - Abstain: ${results.votes.abstain.count} votes (${results.votes.abstain.weight.toFixed(2)} weight)`);
      }

    } catch (error) {
      console.error(`❌ Error in voting test:`, error.message);
    }
  }

  async migrate() {
    console.log('\n🚀 Starting Governance Data Migration...\n');

    // Test connection
    const connected = await this.testConnection();
    if (!connected) {
      console.error('❌ Cannot connect to API. Make sure the server is running.');
      return;
    }

    try {
      // Load and migrate agents
      const evaluations = this.loadModelEvaluations();
      if (evaluations.length > 0) {
        await this.migrateAgents(evaluations);
      }

      // Create test proposals
      const proposals = await this.createTestProposals();

      // Test voting system
      if (proposals.length > 0) {
        await this.testVotingSystem(proposals);
      }

      // Show system statistics
      await this.showSystemStats();

      console.log('\n🎉 Migration and testing completed successfully!');
      console.log('\n🌐 System endpoints:');
      console.log(`- API: ${this.apiUrl}`);
      console.log(`- Swagger: http://localhost:23080/api`);
      console.log(`- Health: ${this.apiUrl}/governance/health`);
      console.log(`- Voting: ${this.apiUrl}/voting/status`);

    } catch (error) {
      console.error('❌ Migration failed:', error.message);
    }
  }

  async showSystemStats() {
    console.log('\n📊 System Statistics:');
    const fetch = (await import('node-fetch')).default;

    try {
      // Agent stats
      const agentsResponse = await fetch(`${this.apiUrl}/agents/statistics`);
      if (agentsResponse.ok) {
        const agentStats = await agentsResponse.json();
        console.log(`- Agents: ${agentStats.total} total, ${agentStats.active || 0} active`);
      }

      // Proposal stats  
      const proposalsResponse = await fetch(`${this.apiUrl}/proposals/statistics`);
      if (proposalsResponse.ok) {
        const proposalStats = await proposalsResponse.json();
        console.log(`- Proposals: ${proposalStats.total} total`);
        if (proposalStats.byStatus) {
          Object.entries(proposalStats.byStatus).forEach(([status, count]) => {
            console.log(`  - ${status}: ${count}`);
          });
        }
      }

      // Voting system status
      const votingResponse = await fetch(`${this.apiUrl}/voting/status`);
      if (votingResponse.ok) {
        const votingStats = await votingResponse.json();
        console.log(`- Voting: ${votingStats.activeSessions} active sessions`);
      }

    } catch (error) {
      console.warn('⚠️ Could not fetch system statistics');
    }
  }
}

// Main execution
async function main() {
  const migrator = new GovernanceMigrator();
  await migrator.migrate();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = GovernanceMigrator;
