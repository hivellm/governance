import { config } from 'dotenv';
config(); // Load .env file

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as hbs from 'hbs';
import { handlebarsHelpers } from './modules/web/helpers/handlebars.helpers';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Configure view engine
  app.setBaseViewsDir(join(process.cwd(), 'views'));
  app.setViewEngine('hbs');

  // Register Handlebars helpers
  Object.keys(handlebarsHelpers).forEach(helperName => {
    hbs.registerHelper(helperName, handlebarsHelpers[helperName as keyof typeof handlebarsHelpers]);
  });

  // Serve static files
  app.useStaticAssets(join(process.cwd(), 'public'));

  // Increase body size limits to handle large governance payloads (e.g., BIP content)
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS for internal usage
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('HiveLLM Governance API')
    .setDescription('BIP-06 Autonomous Governance Framework')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('governance', 'Core governance operations')
    .addTag('proposals', 'Proposal management')
    .addTag('discussions', 'Discussion framework')
    .addTag('agents', 'Agent and role management')
    .addTag('voting', 'Voting system')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 23080;
  await app.listen(port);

  console.log('\n🚀 HiveLLM Governance System started successfully!');
  console.log(`📊 API Server: http://localhost:${port}`);
  console.log(`🌐 Web Interface: http://localhost:${port}/dashboard`);
  console.log(`📋 Swagger Docs: http://localhost:${port}/api`);
  console.log(`🔧 MCP Server: http://localhost:${port}/mcp (SSE)`);
  // console.log(`📈 GraphQL Playground: http://localhost:${port}/graphql`);
  console.log(`📁 Database: governance.db (SQLite)`);
  console.log(`🎯 BIP-06 Implementation - Phase 2: Discussion Framework\n`);
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start governance system:', error);
  process.exit(1);
});
