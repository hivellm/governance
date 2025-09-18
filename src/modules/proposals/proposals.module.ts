import { Module } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { ProposalsController } from './proposals.controller';
import { ProposalsResolver } from './proposals.resolver';

@Module({
  providers: [ProposalsService, ProposalsResolver],
  controllers: [ProposalsController],
  exports: [ProposalsService],
})
export class ProposalsModule {}
