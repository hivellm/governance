import { Resolver, Query, ObjectType, Field } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { GovernanceService } from './governance.service';

@ObjectType()
class SystemStatus {
  @Field()
  status: string;

  @Field()
  phase: string;

  @Field(() => String)
  modules: any; // JSON object

  @Field(() => String)
  database: any; // JSON object
}

@Resolver()
export class GovernanceResolver {
  private readonly logger = new Logger(GovernanceResolver.name);

  constructor(private readonly governanceService: GovernanceService) {}

  @Query(() => SystemStatus, { description: 'Get governance system status' })
  async systemStatus(): Promise<SystemStatus> {
    this.logger.log('GraphQL: Getting system status');
    return this.governanceService.getSystemStatus() as Promise<SystemStatus>;
  }

  @Query(() => String, { description: 'Health check endpoint' })
  async healthCheck(): Promise<string> {
    this.logger.log('GraphQL: Health check');
    return 'ok';
  }
}
