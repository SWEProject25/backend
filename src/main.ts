import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import * as cookieParser from 'cookie-parser';
import { AuthenticatedSocketAdapter } from './messages/adapters/ws-auth.adapter';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const { PORT, FRONTEND_URL_PROD, FRONTEND_URL, NODE_ENV } = process.env;
  const app = await NestFactory.create(AppModule);

  // Configure WebSocket adapter with authentication
  const jwtService = app.get(JwtService);
  const configService = app.get(ConfigService);
  app.useWebSocketAdapter(new AuthenticatedSocketAdapter(jwtService, configService));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.use(cookieParser());
  app.setGlobalPrefix(`api/${process.env.APP_VERSION}`);

  // Support both production frontend and local development
  const allowedOrigins = [
    FRONTEND_URL_PROD, // Production
    FRONTEND_URL, // Development
    'http://localhost:3000', // Local development
    'http://localhost:3001', // Local development (alternative port)
    'http://127.0.0.1:3000', // Local development (127.0.0.1)
    'http://127.0.0.1:3001', // Local development (127.0.0.1 alternative port)
  ].filter(Boolean); // Remove empty strings

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  const swagger = new DocumentBuilder()
    .setTitle('Hankers')
    .setVersion('1.0')
    .addServer(`http://localhost:${PORT}`)
    .addServer(`${process.env.PROD_URL}`)
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
