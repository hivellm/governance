import { Module } from '@nestjs/common';
import { McpModule as RekogMcpModule } from '@rekog/mcp-nest';
import { GovernanceTool } from './governance.tool';
import { McpHttpController } from './mcp-http.controller';
import { ProposalsModule } from '../proposals/proposals.module';
import { DiscussionsModule } from '../discussions/discussions.module';
import { AgentsModule } from '../agents/agents.module';
import { MinutesModule } from '../minutes/minutes.module';
import { BipsModule } from '../bips/bips.module';

@Module({
  imports: [
    RekogMcpModule.forRoot({
      name: 'hivellm-governance-mcp',
      version: '1.0.0',
    }),
    ProposalsModule,
    DiscussionsModule,
    AgentsModule,
    MinutesModule,
    BipsModule,
  ],
  controllers: [McpHttpController],
  providers: [GovernanceTool],
  exports: [GovernanceTool],
})
export class McpModule {}
