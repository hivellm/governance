import { Resolver, Query } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { DiscussionsService } from './discussions.service';

@Resolver()
export class DiscussionsResolver {
  private readonly logger = new Logger(DiscussionsResolver.name);

  constructor(private readonly discussionsService: DiscussionsService) {}

  @Query(() => String, { description: 'Get discussions module status' })
  async discussionsStatus(): Promise<string> {
    this.logger.log('GraphQL: Getting discussions status');
    return this.discussionsService.getStatus();
  }
}
