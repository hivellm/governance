import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { 
  IProposal, 
  ProposalStatus, 
  GovernancePhase, 
  ProposalType,
  ProposalContent,
  ProposalMetadata
} from '../interfaces/proposal.interface';

// Register enums for GraphQL
registerEnumType(ProposalStatus, {
  name: 'ProposalStatus',
  description: 'Current status of the proposal in the governance pipeline',
});

registerEnumType(GovernancePhase, {
  name: 'GovernancePhase',
  description: 'Current phase of the proposal in the governance process',
});

registerEnumType(ProposalType, {
  name: 'ProposalType',
  description: 'Type classification of the proposal',
});

@ObjectType()
export class Proposal implements IProposal {
  @Field(() => ID)
  @ApiProperty({ description: 'Unique proposal identifier' })
  id: string;

  @Field()
  @ApiProperty({ description: 'Proposal title' })
  title: string;

  @Field()
  @ApiProperty({ description: 'ID of the agent who authored the proposal' })
  authorId: string;

  @Field(() => ProposalStatus)
  @ApiProperty({ enum: ProposalStatus, description: 'Current status of the proposal' })
  status: ProposalStatus;

  @Field(() => GovernancePhase)
  @ApiProperty({ enum: GovernancePhase, description: 'Current governance phase' })
  phase: GovernancePhase;

  @Field(() => ProposalType)
  @ApiProperty({ enum: ProposalType, description: 'Type of proposal' })
  type: ProposalType;

  @Field()
  @ApiProperty({ description: 'Proposal content including abstract, motivation, specification, etc.' })
  content: ProposalContent;

  @Field()
  @ApiProperty({ description: 'Additional metadata for the proposal' })
  metadata: ProposalMetadata;

  @Field()
  @ApiProperty({ description: 'When the proposal was created' })
  createdAt: Date;

  @Field()
  @ApiProperty({ description: 'When the proposal was last updated' })
  updatedAt: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Deadline for voting on this proposal', required: false })
  votingDeadline?: Date;

  @Field({ nullable: true })
  @ApiProperty({ description: 'Execution data for implemented proposals', required: false })
  executionData?: any;
}

@ObjectType()
export class ProposalListResponse {
  @Field(() => [Proposal])
  @ApiProperty({ type: [Proposal], description: 'List of proposals' })
  items: Proposal[];

  @Field()
  @ApiProperty({ description: 'Total number of proposals matching the criteria' })
  total: number;

  @Field()
  @ApiProperty({ description: 'Current page number' })
  page: number;

  @Field()
  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @Field()
  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @Field()
  @ApiProperty({ description: 'Whether there is a next page' })
  hasNext: boolean;

  @Field()
  @ApiProperty({ description: 'Whether there is a previous page' })
  hasPrev: boolean;
}
