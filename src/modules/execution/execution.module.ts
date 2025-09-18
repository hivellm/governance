import { Module } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { ExecutionController } from './execution.controller';
import { ExecutionResolver } from './execution.resolver';

@Module({
  providers: [ExecutionService, ExecutionResolver],
  controllers: [ExecutionController],
  exports: [ExecutionService],
})
export class ExecutionModule {}
