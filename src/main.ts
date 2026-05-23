import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';


async function bootstrap() {

  const app = await NestFactory.create(AppModule) as NestExpressApplication;
  // Produccion Netlify: https://sgicdb.netlify.app
  const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
   origin: allowedOrigins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization', // <== aquí está la clave
  });
  
    // Configura ValidationPipe globalmente
    app.useGlobalPipes(new ValidationPipe({
      transform: true,                // Convierte las cargas útiles en instancias de las clases DTO
      whitelist: true,                // Elimina cualquier propiedad que no esté definida en el DTO
      forbidNonWhitelisted: true,     // Lanza un error si hay propiedades no permitidas
      disableErrorMessages: false,    // No desactiva los mensajes de error
    }));
  await app.listen(process.env.PORT ?? 3000);
  

}


bootstrap();
