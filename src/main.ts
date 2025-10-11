import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';

async function bootstrap() {
  const { PORT } = process.env;
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Hankers')
    .addServer(`http://localhost:${PORT}`)
    .setVersion('1.0')
    .addSecurity('bearer', { type: 'http', scheme: 'bearer' })
    .addBearerAuth()
    .build();
  const documentation = SwaggerModule.createDocument(app, swagger);
  // http://localhost:PORT/swagger
  SwaggerModule.setup('swagger', app, documentation);
  writeFileSync(
    './docs/api-documentation.json',
    JSON.stringify(documentation, null, 2),
  );

  try {
    await app.listen(PORT ?? 3001, () =>
      console.log(`Running in port ${PORT}`),
    );
  } catch (error) {
    console.error(error);
  }
}
bootstrap();
