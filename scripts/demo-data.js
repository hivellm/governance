/**
 * Demo Data Script for BIP-06 Governance System
 * Creates sample data to demonstrate the implemented features
 */

const API_BASE = 'http://localhost:23080/api';

async function apiCall(endpoint, method = 'GET', data = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, options);
  
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
    error.status = response.status;
    throw error;
  }
  
  return response.json();
}

async function createDemoData() {
  console.log('🚀 Creating demo data for BIP-06 Governance System...\n');

  try {
    // 1. Create demo agents with different roles
    console.log('👥 Creating demo agents...');
    
    const agents = [
      {
        id: 'alice-proposer',
        name: 'Alice Chen',
        organization: 'TechCorp',
        roles: ['proposer', 'voter'],
        initialPermissions: {}
      },
      {
        id: 'bob-reviewer',
        name: 'Bob Smith',
        organization: 'DevTeam',
        roles: ['reviewer', 'voter'],
        initialPermissions: {}
      },
      {
        id: 'carol-mediator',
        name: 'Carol Johnson',
        organization: 'Governance Council',
        roles: ['mediator', 'voter'],
        initialPermissions: {}
      },
      {
        id: 'david-executor',
        name: 'David Wilson',
        organization: 'Infrastructure',
        roles: ['executor', 'validator'],
        initialPermissions: {}
      }
    ];

    for (const agent of agents) {
      try {
        await apiCall('/agents', 'POST', agent);
        console.log(`  ✅ Created agent: ${agent.name} (${agent.roles.join(', ')})`);
      } catch (error) {
        if (error.status === 409) {
          console.log(`  ⚠️  Agent ${agent.name} already exists`);
        } else {
          console.log(`  ❌ Failed to create agent ${agent.name}: ${error.message}`);
        }
      }
    }

    // 2. Create demo proposals
    console.log('\n📋 Creating demo proposals...');
    
    const proposals = [
      {
        id: 'DEMO-001',
        title: 'Improve API Response Time',
        content: `# Proposal: Improve API Response Time

## Abstract
This proposal suggests implementing caching mechanisms to improve API response times across the governance system.

## Motivation
Current API response times average 50ms. We can reduce this to under 20ms with proper caching.

## Specification
1. Implement Redis caching layer
2. Cache frequently accessed data
3. Add cache invalidation strategies

## Implementation
- Phase 1: Set up Redis infrastructure
- Phase 2: Implement caching middleware
- Phase 3: Monitor and optimize

## Timeline
Expected completion: 2 weeks`,
        type: 'standards',
        metadata: {
          priority: 'high',
          estimatedEffort: '2 weeks',
          dependencies: []
        },
        authorId: 'alice-proposer'
      },
      {
        id: 'DEMO-002',
        title: 'Add Dark Mode Support',
        content: `# Proposal: Add Dark Mode Support

## Abstract
Add dark mode theme support to improve user experience during extended governance sessions.

## Motivation
Many users prefer dark themes for reduced eye strain during long governance discussions.

## Specification
1. Create dark theme CSS variables
2. Add theme toggle component
3. Persist user theme preference

## Implementation
- Update all UI components
- Add theme context provider
- Test accessibility compliance`,
        type: 'informational',
        metadata: {
          priority: 'medium',
          estimatedEffort: '1 week',
          dependencies: []
        },
        authorId: 'alice-proposer'
      }
    ];

    for (const proposal of proposals) {
      try {
        await apiCall('/proposals', 'POST', proposal);
        console.log(`  ✅ Created proposal: ${proposal.title}`);
      } catch (error) {
        if (error.status === 409) {
          console.log(`  ⚠️  Proposal ${proposal.title} already exists`);
        } else {
          console.log(`  ❌ Failed to create proposal ${proposal.title}: ${error.message}`);
        }
      }
    }

    // 3. Demonstrate phase transitions
    console.log('\n🔄 Demonstrating phase transitions...');
    
    try {
      // Advance first proposal to discussion
      await apiCall('/proposals/DEMO-001/advance-to-discussion', 'POST');
      console.log('  ✅ Advanced DEMO-001 to discussion phase');
      
      // Check if we can advance to voting
      const canAdvance = await apiCall('/proposals/DEMO-001/can-advance/voting');
      console.log(`  📊 Can advance to voting: ${canAdvance.canAdvance}`);
      if (!canAdvance.canAdvance) {
        console.log(`     Reasons: ${canAdvance.reasons.join(', ')}`);
      }
    } catch (error) {
      console.log(`  ⚠️  Phase transition demo: ${error.message}`);
    }

    // 4. Demonstrate permission system
    console.log('\n🔐 Demonstrating permission system...');
    
    try {
      // Check if Alice can create proposals
      const alicePermission = await apiCall('/agents/alice-proposer/check-permission', 'POST', {
        action: 'create',
        resource: 'proposals'
      });
      console.log(`  ✅ Alice can create proposals: ${alicePermission.allowed}`);

      // Check if Bob can moderate discussions
      const bobPermission = await apiCall('/agents/bob-reviewer/check-permission', 'POST', {
        action: 'moderate',
        resource: 'discussions'
      });
      console.log(`  ✅ Bob can moderate discussions: ${bobPermission.allowed}`);

      // Get available roles
      const roles = await apiCall('/agents/roles/available');
      console.log(`  📋 Available roles: ${roles.length} roles defined`);

    } catch (error) {
      console.log(`  ⚠️  Permission demo: ${error.message}`);
    }

    // 5. Demonstrate role suggestions
    console.log('\n💡 Demonstrating role suggestions...');
    
    try {
      const suggestions = await apiCall('/agents/suggest-roles', 'POST', {
        desiredPermissions: ['create:proposals', 'vote:proposals', 'moderate:discussions']
      });
      
      console.log(`  🎯 Recommended roles: ${suggestions.recommendedRoles.join(', ')}`);
      console.log(`  📊 Coverage: ${Math.round(suggestions.coverage * 100)}%`);
    } catch (error) {
      console.log(`  ⚠️  Role suggestion demo: ${error.message}`);
    }

    // 6. Show system statistics
    console.log('\n📊 System Statistics...');
    
    try {
      const agentStats = await apiCall('/agents/statistics');
      console.log(`  👥 Total agents: ${agentStats.total}`);
      console.log(`  🟢 Active agents: ${agentStats.active || agentStats.total}`);
      
      const proposals = await apiCall('/proposals');
      console.log(`  📋 Total proposals: ${proposals.items.length}`);
      
      const proposalsByPhase = proposals.items.reduce((acc, p) => {
        acc[p.phase] = (acc[p.phase] || 0) + 1;
        return acc;
      }, {});
      
      console.log('  📈 Proposals by phase:');
      Object.entries(proposalsByPhase).forEach(([phase, count]) => {
        console.log(`     ${phase}: ${count}`);
      });
      
    } catch (error) {
      console.log(`  ⚠️  Statistics demo: ${error.message}`);
    }

    console.log('\n🎉 Demo data creation complete!');
    console.log('\n🔗 Try these URLs:');
    console.log(`   📋 Proposals: ${API_BASE}/proposals`);
    console.log(`   👥 Agents: ${API_BASE}/agents`);
    console.log(`   🔐 Agent Permissions: ${API_BASE}/agents/alice-proposer/permissions`);
    console.log(`   📊 API Documentation: http://localhost:23080/api`);
    
  } catch (error) {
    console.error('❌ Error creating demo data:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the governance server is running:');
      console.log('   npm run start:dev');
    }
  }
}

// Run the demo
createDemoData();