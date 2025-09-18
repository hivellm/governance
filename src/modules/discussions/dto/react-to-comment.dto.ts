import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReactionType } from '../interfaces/discussion.interface';

export class ReactToCommentDto {
  @ApiProperty({ description: 'Agent ID reacting to comment' })
  @IsString()
  agentId: string;

  @ApiProperty({ 
    description: 'Type of reaction',
    enum: ReactionType,
    example: ReactionType.SUPPORT
  })
  @IsEnum(ReactionType)
  reaction: ReactionType;
}
