import { IsString, IsOptional, IsArray, IsObject, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DiscussionSettingsDto {
  @ApiProperty({ description: 'Maximum duration in minutes', example: 60 })
  @IsNumber()
  @Min(5)
  @Max(480) // 8 hours max
  maxDurationMinutes: number;

  @ApiPropertyOptional({ description: 'Allow anonymous comments', example: false })
  @IsOptional()
  @IsBoolean()
  allowAnonymousComments?: boolean;

  @ApiPropertyOptional({ description: 'Require moderation for comments', example: false })
  @IsOptional()
  @IsBoolean()
  requireModeration?: boolean;

  @ApiPropertyOptional({ description: 'Maximum comments per agent', example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  maxCommentsPerAgent?: number;

  @ApiPropertyOptional({ description: 'Allow comment threading', example: true })
  @IsOptional()
  @IsBoolean()
  allowThreading?: boolean;

  @ApiPropertyOptional({ description: 'Auto-close when timeout reached', example: true })
  @IsOptional()
  @IsBoolean()
  autoClose?: boolean;

  @ApiPropertyOptional({ description: 'Minimum participants required', example: 3 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minParticipants?: number;

  @ApiPropertyOptional({ description: 'Maximum participants allowed', example: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxParticipants?: number;
}

export class CreateDiscussionDto {
  @ApiProperty({ description: 'Proposal ID for discussion', example: 'PROP-001' })
  @IsString()
  proposalId: string;

  @ApiPropertyOptional({ description: 'Discussion title', example: 'Technical Review Discussion' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Discussion description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ 
    description: 'Agent IDs with moderation rights',
    example: ['moderator-1', 'mediator-2']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  moderators?: string[];

  @ApiPropertyOptional({ description: 'Discussion settings' })
  @IsOptional()
  @IsObject()
  settings?: DiscussionSettingsDto;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
