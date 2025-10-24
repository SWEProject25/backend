import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const { PORT } = process.env;
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.use(cookieParser());
  app.setGlobalPrefix(`api/${process.env.APP_VERSION}`);
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const swagger = new DocumentBuilder()
    .setTitle('Hankers')
    .setVersion('1.0')
    .addServer(`http://localhost:${PORT}`)
    .addCookieAuth('access_token', {
      type: 'apiKey',
      in: 'cookie',
    })
    .build();

  const documentation = SwaggerModule.createDocument(app, swagger);
  // http://localhost:PORT/swagger
  SwaggerModule.setup('swagger', app, documentation);
  app.getHttpAdapter().get('/swagger.json', (req, res) => {
    res.type('application/json').send(documentation);
  });
  writeFileSync('./docs/api-documentation.json', JSON.stringify(documentation, null, 2));
  writeFileSync('./docs/api-documentation.yaml', JSON.stringify(documentation, null, 2));

  try {
    await app.listen(PORT ?? 3001, () => console.log(`Running in port ${PORT}`));
  } catch (error) {
    console.error(error);
  }
}
bootstrap();
