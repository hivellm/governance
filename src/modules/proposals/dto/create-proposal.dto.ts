import { IsString, IsEnum, IsOptional, IsObject, ValidateNested, MaxLength, MinLength, IsArray, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProposalType } from '../interfaces/proposal.interface';

export class ProposalContentDto {
  @ApiProperty({ description: 'Brief summary of the proposal', maxLength: 500 })
  @IsString()
  @MinLength(50, { message: 'Abstract must be at least 50 characters' })
  @MaxLength(500, { message: 'Abstract must not exceed 500 characters' })
  abstract: string;

  @ApiProperty({ description: 'Motivation and rationale for the proposal', maxLength: 2000 })
  @IsString()
  @MinLength(100, { message: 'Motivation must be at least 100 characters' })
  @MaxLength(2000, { message: 'Motivation must not exceed 2000 characters' })
  motivation: string;

  @ApiProperty({ description: 'Technical specification of the proposal', maxLength: 10000 })
  @IsString()
  @MinLength(200, { message: 'Specification must be at least 200 characters' })
  @MaxLength(10000, { message: 'Specification must not exceed 10000 characters' })
  specification: string;

  @ApiPropertyOptional({ description: 'Implementation details', maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Implementation must not exceed 5000 characters' })
  implementation?: string;

  @ApiPropertyOptional({ description: 'Additional rationale', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Rationale must not exceed 2000 characters' })
  rationale?: string;

  @ApiPropertyOptional({ description: 'Backwards compatibility considerations', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Backwards compatibility must not exceed 1000 characters' })
  backwards_compatibility?: string;

  @ApiPropertyOptional({ description: 'Reference implementation details', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Reference implementation must not exceed 2000 characters' })
  reference_implementation?: string;

  @ApiPropertyOptional({ description: 'Security considerations', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Security considerations must not exceed 1000 characters' })
  security_considerations?: string;

  @ApiPropertyOptional({ description: 'Copyright information', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Copyright must not exceed 200 characters' })
  copyright?: string;
}

export class ProposalMetadataDto {
  @ApiPropertyOptional({ description: 'Dependencies on other proposals', type: [String] })
  @IsOptional()
  @IsString({ each: true })
  dependencies?: string[];

  @ApiPropertyOptional({ description: 'Proposals this replaces', type: [String] })
  @IsOptional()
  @IsString({ each: true })
  replaces?: string[];

  @ApiPropertyOptional({ description: 'Categories for the proposal', type: [String] })
  @IsOptional()
  @IsString({ each: true })
  category?: string[];

  @ApiPropertyOptional({ description: 'Discussion thread reference' })
  @IsOptional()
  @IsString()
  discussions_to?: string;

  @ApiPropertyOptional({ description: 'Author GitHub username' })
  @IsOptional()
  @IsString()
  author_github?: string;

  @ApiPropertyOptional({ description: 'Author email address' })
  @IsOptional()
  @IsString()
  author_email?: string;

  @ApiPropertyOptional({ description: 'Required BIPs or proposals', type: [String] })
  @IsOptional()
  @IsString({ each: true })
  requires?: string[];

  // Extended fields to preserve rich @metadata from /gov
  @ApiPropertyOptional({ description: 'Original status from metadata (e.g., active, approved)' })
  @IsOptional()
  @IsString()
  original_status?: string;

  @ApiPropertyOptional({ description: 'Original type (e.g., standards-track, process, informational)' })
  @IsOptional()
  @IsString()
  original_type?: string;

  @ApiPropertyOptional({ description: 'License identifier (e.g., MIT)' })
  @IsOptional()
  @IsString()
  license?: string;

  @ApiPropertyOptional({ description: 'Proposer model name' })
  @IsOptional()
  @IsString()
  proposer_model?: string;

  @ApiPropertyOptional({ description: 'Proposer provider' })
  @IsOptional()
  @IsString()
  proposer_provider?: string;

  @ApiPropertyOptional({ description: 'Proposer role' })
  @IsOptional()
  @IsString()
  proposer_role?: string;

  @ApiPropertyOptional({ description: 'Tags' , type: [String]})
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Estimated effort' })
  @IsOptional()
  @IsString()
  estimatedEffort?: string;

  @ApiPropertyOptional({ description: 'Benefits', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];

  @ApiPropertyOptional({ description: 'Challenges', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  challenges?: string[];

  @ApiPropertyOptional({ description: 'Impact details' })
  @IsOptional()
  @IsObject()
  impact?: {
    scope?: string;
    complexity?: string;
    priority?: string;
  };

  @ApiPropertyOptional({ description: 'References', type: 'array' })
  @IsOptional()
  @IsArray()
  references?: Array<{
    title?: string;
    url?: string;
    type?: string;
  }>;

  @ApiPropertyOptional({ description: 'Consolidation info' })
  @IsOptional()
  @IsObject()
  consolidation?: {
    isConsolidated?: boolean;
    consolidatedInto?: string;
    consolidatedId?: string;
    consolidatedFile?: string;
    implementationStatus?: string;
    implementedAt?: string;
    status?: string;
    bipNumber?: string;
    note?: string;
  };

  @ApiPropertyOptional({ description: 'Original createdAt (metadata)' })
  @IsOptional()
  @IsString()
  original_createdAt?: string;

  @ApiPropertyOptional({ description: 'Original updatedAt (metadata)' })
  @IsOptional()
  @IsString()
  original_updatedAt?: string;
}

export class CreateProposalDto {
  @ApiPropertyOptional({ description: 'Deterministic proposal ID (e.g., P056). If omitted, server may derive it.' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ 
    description: 'Title of the proposal', 
    minLength: 10, 
    maxLength: 255,
    example: 'Autonomous Governance Framework Enhancement'
  })
  @IsString()
  @MinLength(10, { message: 'Title must be at least 10 characters' })
  @MaxLength(255, { message: 'Title must not exceed 255 characters' })
  title: string;

  @ApiProperty({ 
    description: 'Type of proposal',
    enum: ProposalType,
    example: ProposalType.STANDARDS
  })
  @IsEnum(ProposalType, { message: 'Type must be one of: standards, informational, process' })
  type: ProposalType;

  @ApiProperty({ description: 'Proposal content', type: ProposalContentDto })
  @IsObject()
  @ValidateNested()
  @Type(() => ProposalContentDto)
  content: ProposalContentDto;

  @ApiPropertyOptional({ description: 'Additional metadata', type: ProposalMetadataDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ProposalMetadataDto)
  metadata?: ProposalMetadataDto;
}
