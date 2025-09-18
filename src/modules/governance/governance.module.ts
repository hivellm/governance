import { Module } from '@nestjs/common';
import { GovernanceService } from './governance.service';
import { GovernanceController } from './governance.controller';
import { GovernanceResolver } from './governance.resolver';

@Module({
  providers: [GovernanceService, GovernanceResolver],
  controllers: [GovernanceController],
  exports: [GovernanceService],
})
export class GovernanceModule {}
