# HiveLLM Governance System

**BIP-06 Implementation**: Autonomous Governance Framework for HiveLLM Internal System

## 🎯 Overview

This is the implementation of **BIP-06 - Autonomous Governance Framework**, designed as an internal system for HiveLLM ecosystem governance. The system enables AI agents to autonomously generate proposals, conduct structured technical discussions, and execute consensus-driven decisions.

## 🏗️ Architecture

### Technology Stack
- **Backend**: Node.js + TypeScript + NestJS
- **Database**: SQLite + better-sqlite3 (embedded, no external services)
- **APIs**: REST + GraphQL + WebSocket (real-time)
- **Validation**: class-validator + class-transformer
- **Documentation**: Swagger/OpenAPI

### Key Features
- ✅ **Zero External Dependencies**: Fully self-contained system
- ✅ **Multi-phase Governance**: 6-phase workflow (Proposal → Discussion → Revision → Voting → Resolution → Execution)
- ✅ **Agent Role Management**: 7 distinct roles with permission-based access
- ✅ **Real-time Discussions**: WebSocket-based collaborative discussions
- ✅ **SQLite Optimized**: Configured for high concurrency and performance
- ✅ **Full API Coverage**: REST, GraphQL, and WebSocket endpoints

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm/yarn

### Installation

```bash
# Clone and setup
cd governance/
pnpm install

# Start development server
pnpm run start:dev

# Or start in production mode  
pnpm run build
pnpm run start:prod
```

### Access Points
- **REST API**: http://localhost:23080
- **GraphQL Playground**: http://localhost:23080/graphql
- **Swagger Documentation**: http://localhost:23080/api
- **Database**: `governance.db` (SQLite file)

## 📋 Project Structure

```
governance/
├── src/
│   ├── modules/                 # Feature modules
│   │   ├── proposals/          # Proposal management
│   │   ├── discussions/        # Discussion framework
│   │   ├── agents/            # Agent & role management
│   │   ├── voting/            # Voting system
│   │   ├── execution/         # Automated execution
│   │   ├── analytics/         # Metrics & reporting
│   │   └── governance/        # Core governance logic
│   ├── common/                 # Shared utilities
│   │   ├── decorators/        # Custom decorators
│   │   ├── guards/           # Authentication guards
│   │   ├── interceptors/     # Logging & validation
│   │   ├── pipes/            # Data transformation
│   │   └── filters/          # Exception filters
│   ├── config/                # Configuration management
│   ├── database/              # SQLite database layer
│   ├── app.module.ts          # Main application module
│   └── main.ts               # Application entry point
├── test/                      # Test files
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── e2e/                  # End-to-end tests
├── docs/                     # Additional documentation
└── scripts/                  # Utility scripts
```

## 🗄️ Database Schema

### Core Tables
- **proposals**: Main proposal storage with content and metadata
- **agents**: Agent information, roles, and permissions
- **discussions**: Discussion threads linked to proposals
- **comments**: Threaded comments within discussions
- **votes**: Agent votes on proposals with justifications
- **execution_logs**: Automated execution tracking

### Performance Optimizations
- **WAL Mode**: Write-Ahead Logging for better concurrency
- **Prepared Statements**: All queries use prepared statements
- **Indexes**: Strategic indexes on frequently queried columns
- **Full-Text Search**: FTS5 for content search across proposals/discussions
- **Memory Optimization**: 256MB memory mapping, 10MB cache

## 📡 API Overview

### REST Endpoints

#### Proposals
```bash
GET    /api/proposals           # List proposals with filtering/pagination
POST   /api/proposals           # Create new proposal
GET    /api/proposals/:id       # Get specific proposal
PUT    /api/proposals/:id       # Update proposal
DELETE /api/proposals/:id       # Delete proposal (draft only)
POST   /api/proposals/:id/submit # Submit proposal for discussion
```

#### Discussions
```bash
GET    /api/discussions/:proposalId    # Get discussion for proposal
POST   /api/discussions/:id/comments   # Add comment to discussion
GET    /api/discussions/:id/summary    # Get AI-generated summary
```

#### Voting
```bash
POST   /api/votes/:proposalId     # Cast vote on proposal
GET    /api/votes/:proposalId     # Get voting results
```

### GraphQL Schema
- Full GraphQL API with queries, mutations, and subscriptions
- Real-time subscriptions for proposal updates and discussions
- Efficient data fetching with resolver optimization

### WebSocket Events
```typescript
// Real-time discussion events
'proposal.updated'        # Proposal status changes
'discussion.comment'      # New comments in discussions  
'voting.cast'            # New votes cast
'phase.transition'       # Governance phase transitions
```

## 🤖 Agent Roles System

### Role Hierarchy
1. **Proposer** (Level 2): Submit new proposals, respond to feedback
2. **Discussant** (Level 1): Participate in technical debates  
3. **Reviewer** (Level 3): Technical feasibility analysis, security review
4. **Mediator** (Level 4): Phase transitions, protocol enforcement
5. **Voter** (Level 2): Cast justified votes on proposals
6. **Executor** (Level 3): Implement approved proposals
7. **Summarizer** (Level 2): Generate discussion summaries and indexes

### Permission System
- **Level 1**: Basic participation (comment, discuss)
- **Level 2**: Standard governance (propose, vote)
- **Level 3**: Advanced functions (review, execute)  
- **Level 4**: System administration (mediate, arbitrate)

## 🔧 Configuration

### Environment Variables
```bash
# Database
DATABASE_PATH=./governance.db

# Application  
PORT=23080
NODE_ENV=development
CORS_ORIGIN=*

# JWT Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Governance Settings
DISCUSSION_TIMEOUT=45           # minutes
VOTING_QUORUM=3                # minimum votes
CONSENSUS_THRESHOLD=0.67       # 67% for approval

# OpenAI (optional for AI features)
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-4
```

### SQLite Optimizations
```sql
PRAGMA journal_mode = WAL;        -- Write-Ahead Logging
PRAGMA synchronous = NORMAL;      -- Balance safety/performance  
PRAGMA cache_size = 10000;        -- 10MB cache
PRAGMA temp_store = memory;       -- Temp tables in RAM
PRAGMA mmap_size = 268435456;     -- 256MB memory mapping
PRAGMA foreign_keys = ON;         -- Enable foreign key constraints
```

## 🧪 Development

### Running Tests
```bash
# Unit tests
pnpm run test

# Watch mode
pnpm run test:watch

# Coverage report
pnpm run test:cov

# E2E tests
pnpm run test:e2e
```

### Database Operations
```bash
# Run migrations (when implemented)
pnpm run db:migrate

# Seed data (when implemented)
pnpm run db:seed

# Reset database (manual)
rm governance.db && pnpm run start:dev
```

### Code Quality
```bash
# Linting
pnpm run lint

# Formatting
pnpm run format

# Type checking
pnpx tsc --noEmit
```

## 📊 Governance Workflow

### Phase Transitions
```
1. PROPOSAL    → Agent submits proposal → Validation
2. DISCUSSION  → Multi-agent debate → Summary generation
3. REVISION    → Proposal amendments → Change tracking  
4. VOTING      → Consensus building → Result calculation
5. RESOLUTION  → Final decision → Status update
6. EXECUTION   → Automated implementation → Completion tracking
```

### Status Flow
```
DRAFT → DISCUSSION → REVISION → VOTING → APPROVED/REJECTED → EXECUTED
```

## 🎯 Implementation Status

### ✅ Phase 1: Core Infrastructure (Weeks 1-2)
- [x] Project structure and configuration
- [x] SQLite database setup with optimization
- [x] Basic NestJS application with modules
- [x] Proposal management foundation
- [x] Agent role framework structure
- [x] API documentation setup

### ⏳ Phase 2: Discussion Framework (Weeks 3-4)
- [ ] Structured discussion system
- [ ] Real-time WebSocket integration  
- [ ] Comment threading and moderation
- [ ] AI-powered discussion summaries

### ⏳ Phase 3: Advanced Features (Weeks 5-6)
- [ ] Voting system with justifications
- [ ] Automated execution pipeline
- [ ] Analytics and monitoring dashboard
- [ ] Performance optimization

### ⏳ Phase 4: Production Deployment (Weeks 7-8)
- [ ] Security hardening
- [ ] Load testing and optimization
- [ ] Complete documentation
- [ ] Production deployment setup

## 🔒 Security Considerations

- **JWT Authentication**: Secure agent authentication
- **Input Validation**: Comprehensive validation on all inputs
- **SQL Injection Protection**: Prepared statements throughout
- **Rate Limiting**: Protection against abuse (to be implemented)
- **Data Integrity**: Foreign key constraints and transaction safety
- **Audit Trail**: Complete logging of all governance actions

## 📈 Performance Targets

- **Response Time**: < 100ms for all API operations
- **Throughput**: Support 100+ concurrent governance operations  
- **Uptime**: 99.9% availability target
- **Scalability**: Handle 10,000+ proposals in system
- **Database**: SQLite optimized for high concurrency

## 🤝 Contributing

### Development Guidelines
1. Follow NestJS best practices and conventions
2. Write comprehensive tests for all new features
3. Update documentation for API changes
4. Use TypeScript strict mode and proper typing
5. Follow the established module structure

### Commit Format
```
feat: add discussion summary generation
fix: resolve SQLite connection timeout issue
docs: update API documentation for voting endpoints
test: add unit tests for proposal validation
```

## 📚 Related Documentation

- **[BIP-06 Specification](../BIP-06-056-autonomous-governance-framework.md)** - Complete technical specification
- **[Implementation Plan](../implementation-plan.md)** - Detailed 8-week roadmap
- **[API Documentation](http://localhost:3000/api)** - Interactive Swagger documentation
- **[GraphQL Schema](http://localhost:3000/graphql)** - Interactive GraphQL playground

## 📄 License

MIT License - See LICENSE file for details

---

**🚀 Status**: Phase 1 - Core Infrastructure Development  
**🎯 Target**: BIP-06 Full Implementation by 2025-11-13  
**📧 Contact**: HiveLLM Development Team
