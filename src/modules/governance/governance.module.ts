import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GovernanceService } from './governance.service';
import { GovernanceController } from './governance.controller';
import { GovernanceResolver } from './governance.resolver';
import { PhaseManagementService } from './services/phase-management.service';
import { PhaseManagementController } from './controllers/phase-management.controller';

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [GovernanceService, GovernanceResolver, PhaseManagementService],
  controllers: [GovernanceController, PhaseManagementController],
  exports: [GovernanceService, PhaseManagementService],
})
export class GovernanceModule {}
