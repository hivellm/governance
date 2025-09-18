import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';

// Core modules
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';

// Feature modules
import { GovernanceModule } from './modules/governance/governance.module';
import { ProposalsModule } from './modules/proposals/proposals.module';
import { DiscussionsModule } from './modules/discussions/discussions.module';
import { AgentsModule } from './modules/agents/agents.module';
import { VotingModule } from './modules/voting/voting.module';
import { ExecutionModule } from './modules/execution/execution.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot(),

    // Database
    DatabaseModule,

    // GraphQL
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true,
      introspection: true,
      subscriptions: {
        'graphql-ws': true,
        'subscriptions-transport-ws': true,
      },
    }),

    // Feature modules
    GovernanceModule,
    ProposalsModule,
    DiscussionsModule,
    AgentsModule,
    VotingModule,
    ExecutionModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
