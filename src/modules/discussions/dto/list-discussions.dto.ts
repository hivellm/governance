import { IsOptional, IsArray, IsString, IsEnum, IsBoolean, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DiscussionStatus } from '../interfaces/discussion.interface';

export class ListDiscussionsDto {
  @ApiPropertyOptional({ description: 'Filter by proposal ID' })
  @IsOptional()
  @IsString()
  proposalId?: string;

  @ApiPropertyOptional({ 
    description: 'Filter by discussion status',
    enum: DiscussionStatus,
    isArray: true
  })
  @IsOptional()
  @IsArray()
  @IsEnum(DiscussionStatus, { each: true })
  status?: DiscussionStatus[];

  @ApiPropertyOptional({ description: 'Filter by participant agent ID' })
  @IsOptional()
  @IsString()
  participantId?: string;

  @ApiPropertyOptional({ description: 'Filter by moderator agent ID' })
  @IsOptional()
  @IsString()
  moderatorId?: string;

  @ApiPropertyOptional({ description: 'Filter discussions created after this date' })
  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @ApiPropertyOptional({ description: 'Filter discussions created before this date' })
  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @ApiPropertyOptional({ description: 'Filter discussions with active summaries' })
  @IsOptional()
  @IsBoolean()
  hasActiveSummary?: boolean;

  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', example: 20 })
  @IsOptional()
  limit?: number;
}
