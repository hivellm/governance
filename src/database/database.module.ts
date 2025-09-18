import { Module, Global } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { ConfigService } from '../config/config.service';

@Global()
@Module({
  providers: [DatabaseService, ConfigService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
