import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DiscussionsService } from './discussions.service';
import { DiscussionsController } from './discussions.controller';
import { DiscussionsResolver } from './discussions.resolver';
import { AIOrchestrationService } from './services/ai-orchestration.service';
import { DiscussionOrchestratorService } from './services/discussion-orchestrator.service';
import { ModelCallerService } from './services/model-caller.service';
import { DiscussionMediatorService } from './services/discussion-mediator.service';
import { ProposalsModule } from '../proposals/proposals.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ProposalsModule,
    AgentsModule
  ],
  providers: [
    DiscussionsService, 
    DiscussionsResolver,
    AIOrchestrationService,
    ModelCallerService,
    DiscussionMediatorService,
    DiscussionOrchestratorService
  ],
  controllers: [DiscussionsController],
  exports: [DiscussionsService, AIOrchestrationService],
})
export class DiscussionsModule {}
