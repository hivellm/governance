import { Controller, Get, Post, Body, Param, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { TeamsService, TeamRecord } from './teams.service';

class UpsertTeamDto {
  id: string;
  name: string;
  members?: string[];
  metadata?: any;
}

@ApiTags('teams')
@Controller('api/teams')
export class TeamsController {
  private readonly logger = new Logger(TeamsController.name);

  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @ApiOperation({ summary: 'List teams' })
  @ApiResponse({ status: HttpStatus.OK })
  async list(): Promise<TeamRecord[]> {
    return this.teamsService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get team by id' })
  @ApiResponse({ status: HttpStatus.OK })
  async get(@Param('id') id: string): Promise<TeamRecord | null> {
    return this.teamsService.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create or update a team' })
  @ApiBody({ type: UpsertTeamDto })
  @ApiResponse({ status: HttpStatus.CREATED })
  async upsert(@Body() dto: UpsertTeamDto): Promise<TeamRecord> {
    this.logger.log(`Upserting team ${dto.id}`);
    return this.teamsService.upsert({ id: dto.id, name: dto.name, members: dto.members || [], metadata: dto.metadata || {} });
  }
}


