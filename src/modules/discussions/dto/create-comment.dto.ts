import { IsString, IsOptional, IsArray, IsObject, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommentType } from '../interfaces/discussion.interface';

export class CreateCommentDto {
  @ApiProperty({ description: 'Discussion ID', example: 'disc-001' })
  @IsString()
  discussionId: string;

  @ApiProperty({ description: 'Author agent ID', example: 'agent-123' })
  @IsString()
  authorId: string;

  @ApiPropertyOptional({ description: 'Parent comment ID for threading', example: 'comment-456' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ 
    description: 'Type of comment',
    enum: CommentType,
    example: CommentType.COMMENT
  })
  @IsEnum(CommentType)
  type: CommentType;

  @ApiProperty({ description: 'Comment content', example: 'This is a thoughtful comment about the proposal.' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ 
    description: 'Referenced sections or entities',
    example: ['section-3.2', 'proposal-abstract']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  references?: string[];

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateCommentDto {
  @ApiPropertyOptional({ description: 'Updated comment content' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ 
    description: 'Updated comment type',
    enum: CommentType
  })
  @IsOptional()
  @IsEnum(CommentType)
  type?: CommentType;

  @ApiPropertyOptional({ 
    description: 'Updated references',
    example: ['section-3.2', 'proposal-abstract']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  references?: string[];

  @ApiPropertyOptional({ description: 'Updated metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
