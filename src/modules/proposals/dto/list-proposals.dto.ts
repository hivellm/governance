import { IsOptional, IsEnum, IsString, IsInt, Min, Max, IsArray, IsDateString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProposalStatus, GovernancePhase, ProposalType } from '../interfaces/proposal.interface';

export class ListProposalsDto {
  @ApiPropertyOptional({ description: 'Page number for pagination', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of items per page', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit must not exceed 100' })
  limit?: number = 20;

  @ApiPropertyOptional({ 
    description: 'Field to sort by', 
    enum: ['created_at', 'updated_at', 'title', 'status'],
    default: 'created_at'
  })
  @IsOptional()
  @IsEnum(['created_at', 'updated_at', 'title', 'status'], {
    message: 'SortBy must be one of: created_at, updated_at, title, status'
  })
  sortBy?: 'created_at' | 'updated_at' | 'title' | 'status' = 'created_at';

  @ApiPropertyOptional({ 
    description: 'Sort order', 
    enum: ['asc', 'desc'],
    default: 'desc'
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'SortOrder must be either asc or desc' })
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ 
    description: 'Filter by proposal status', 
    enum: ProposalStatus,
    isArray: true
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ProposalStatus, { 
    each: true, 
    message: 'Each status must be one of: draft, discussion, revision, voting, approved, rejected, executed' 
  })
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  status?: ProposalStatus[];

  @ApiPropertyOptional({ 
    description: 'Filter by governance phase', 
    enum: GovernancePhase,
    isArray: true
  })
  @IsOptional()
  @IsArray()
  @IsEnum(GovernancePhase, { 
    each: true, 
    message: 'Each phase must be one of: proposal, discussion, revision, voting, resolution, execution' 
  })
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  phase?: GovernancePhase[];

  @ApiPropertyOptional({ 
    description: 'Filter by proposal type', 
    enum: ProposalType,
    isArray: true
  })
  @IsOptional()
  @IsArray()
  @IsEnum(ProposalType, { 
    each: true, 
    message: 'Each type must be one of: standards, informational, process' 
  })
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  type?: ProposalType[];

  @ApiPropertyOptional({ description: 'Filter by author ID' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({ description: 'Filter proposals created after this date' })
  @IsOptional()
  @IsDateString({}, { message: 'DateFrom must be a valid ISO date string' })
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter proposals created before this date' })
  @IsOptional()
  @IsDateString({}, { message: 'DateTo must be a valid ISO date string' })
  dateTo?: string;

  @ApiPropertyOptional({ 
    description: 'Search text in title, abstract, and content',
    minLength: 3,
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  searchText?: string;
}
