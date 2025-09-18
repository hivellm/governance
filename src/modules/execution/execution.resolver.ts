import { Resolver, Query } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { ExecutionService } from './execution.service';

@Resolver()
export class ExecutionResolver {
  private readonly logger = new Logger(ExecutionResolver.name);

  constructor(private readonly executionService: ExecutionService) {}

  @Query(() => String, { description: 'Get execution module status' })
  async executionStatus(): Promise<string> {
    this.logger.log('GraphQL: Getting execution status');
    return this.executionService.placeholder();
  }
}
