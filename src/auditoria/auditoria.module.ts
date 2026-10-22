import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';
import { AuditoriaInterceptor, AuditoriaMiddleware } from './auditoria-http';

@Module({
  controllers: [AuditoriaController],
  providers: [AuditoriaService, { provide: APP_INTERCEPTOR, useClass: AuditoriaInterceptor }],
})
export class AuditoriaModule implements NestModule {
  // Aplica el middleware de auditoría a las rutas del backend para crear el contexto de cada
  // petición.
  configure(consumer: MiddlewareConsumer) { consumer.apply(AuditoriaMiddleware).forRoutes('*'); }
}
