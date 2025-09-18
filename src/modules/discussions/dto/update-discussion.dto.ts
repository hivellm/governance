import { IsString, IsOptional, IsArray, IsObject, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DiscussionStatus } from '../interfaces/discussion.interface';
import { DiscussionSettingsDto } from './create-discussion.dto';

export class UpdateDiscussionDto {
  @ApiPropertyOptional({ description: 'Updated discussion title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Updated discussion description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ 
    description: 'Updated discussion status',
    enum: DiscussionStatus
  })
  @IsOptional()
  @IsEnum(DiscussionStatus)
  status?: DiscussionStatus;

  @ApiPropertyOptional({ 
    description: 'Updated moderator list',
    example: ['moderator-1', 'mediator-2']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  moderators?: string[];

  @ApiPropertyOptional({ description: 'Updated discussion settings' })
  @IsOptional()
  @IsObject()
  settings?: Partial<DiscussionSettingsDto>;

  @ApiPropertyOptional({ description: 'Updated metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
