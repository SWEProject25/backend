import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const { PORT } = process.env;
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
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
