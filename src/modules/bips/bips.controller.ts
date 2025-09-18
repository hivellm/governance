import { Controller, Get, Param, Post, Body, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { BipsService, BipRecord } from './bips.service';

class UpsertBipDto {
  id: string;
  title: string;
  status?: string;
  content?: any;
  metadata?: any;
}

@ApiTags('bips')
@Controller('api/bips')
export class BipsController {
  private readonly logger = new Logger(BipsController.name);

  constructor(private readonly bipsService: BipsService) {}

  @Get()
  @ApiOperation({ summary: 'List all BIPs' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of BIPs' })
  async list(): Promise<BipRecord[]> {
    return this.bipsService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a BIP by id' })
  @ApiResponse({ status: HttpStatus.OK, description: 'BIP found' })
  async get(@Param('id') id: string): Promise<BipRecord | null> {
    return this.bipsService.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create or update a BIP' })
  @ApiBody({ type: UpsertBipDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'BIP upserted' })
  async upsert(@Body() dto: UpsertBipDto): Promise<BipRecord> {
    this.logger.log(`Upserting BIP ${dto.id}: ${dto.title}`);
    return this.bipsService.upsert(dto);
  }
}


