import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentsResolver } from './agents.resolver';
import { PermissionsService } from './services/permissions.service';

@Module({
  providers: [AgentsService, AgentsResolver, PermissionsService],
  controllers: [AgentsController],
  exports: [AgentsService, PermissionsService],
})
export class AgentsModule {}
