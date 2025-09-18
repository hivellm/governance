import { Resolver, Query } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { VotingService } from './voting.service';

@Resolver()
export class VotingResolver {
  private readonly logger = new Logger(VotingResolver.name);

  constructor(private readonly votingService: VotingService) {}

  @Query(() => String, { description: 'Get voting module status' })
  async votingStatus(): Promise<string> {
    this.logger.log('GraphQL: Getting voting status');
    return 'BIP-06 Automated Voting System is operational';
  }
}
