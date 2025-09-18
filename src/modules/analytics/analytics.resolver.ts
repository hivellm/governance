import { Resolver, Query } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Resolver()
export class AnalyticsResolver {
  private readonly logger = new Logger(AnalyticsResolver.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Query(() => String, { description: 'Get analytics module status' })
  async analyticsStatus(): Promise<string> {
    this.logger.log('GraphQL: Getting analytics status');
    return this.analyticsService.placeholder();
  }
}
