import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log('\n🚀 HiveLLM Governance System started successfully!');
  console.log(`📊 API Server: http://localhost:${port}`);
  console.log(`📋 Swagger Docs: http://localhost:${port}/api`);
  console.log(`📈 GraphQL Playground: http://localhost:${port}/graphql`);
  console.log(`📁 Database: governance.db (SQLite)`);
  console.log(`🎯 BIP-06 Implementation - Phase 1: Core Infrastructure\n`);
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start governance system:', error);
  process.exit(1);
});
