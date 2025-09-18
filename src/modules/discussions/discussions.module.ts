import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DiscussionsService } from './discussions.service';
import { DiscussionsController } from './discussions.controller';
import { DiscussionsResolver } from './discussions.resolver';

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [DiscussionsService, DiscussionsResolver],
  controllers: [DiscussionsController],
  exports: [DiscussionsService],
})
export class DiscussionsModule {}
