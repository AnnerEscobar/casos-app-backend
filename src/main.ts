import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {

  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: 'http://localhost:4200',
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Content-Type, Accept',
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
