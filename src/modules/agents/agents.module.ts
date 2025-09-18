import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentsResolver } from './agents.resolver';

@Module({
  providers: [AgentsService, AgentsResolver],
  controllers: [AgentsController],
  exports: [AgentsService],
})
export class AgentsModule {}
