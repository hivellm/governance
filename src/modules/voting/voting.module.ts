import { Module } from '@nestjs/common';
import { VotingService } from './voting.service';
import { VotingController } from './voting.controller';
import { VotingResolver } from './voting.resolver';
import { DatabaseModule } from '../../database/database.module';
import { AgentsModule } from '../agents/agents.module';
import { ProposalsModule } from '../proposals/proposals.module';

@Module({
  imports: [DatabaseModule, AgentsModule, ProposalsModule],
  providers: [VotingService, VotingResolver],
  controllers: [VotingController],
  exports: [VotingService],
})
export class VotingModule {}
