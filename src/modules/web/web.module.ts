import { Module } from '@nestjs/common';
import { WebController } from './web.controller';
import { ProposalsModule } from '../proposals/proposals.module';
import { AgentsModule } from '../agents/agents.module';
import { DiscussionsModule } from '../discussions/discussions.module';
import { VotingModule } from '../voting/voting.module';
import { MinutesModule } from '../minutes/minutes.module';
import { BipsModule } from '../bips/bips.module';
import { GovernanceModule } from '../governance/governance.module';

@Module({
  imports: [
    ProposalsModule,
    AgentsModule,
    DiscussionsModule,
    VotingModule,
    MinutesModule,
    BipsModule,
    GovernanceModule,
  ],
  controllers: [WebController],
})
export class WebModule {}
