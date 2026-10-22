import { CallHandler, ExecutionContext, ForbiddenException, Injectable, Logger, NestInterceptor, NestMiddleware, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { defer, lastValueFrom } from 'rxjs';
import { contextoAuditoria, ContextoAuditoria } from './auditoria-core';
import { AuditoriaService } from './auditoria.service';

@Injectable()
export class AuditoriaMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditoriaMiddleware.name);
  // Recibe las dependencias que permiten registrar eventos y, en el interceptor, gestionar la
  // conexión y las transacciones de MongoDB.
  constructor(private readonly auditoria: AuditoriaService) {}
  // Crea el contexto de auditoría de la petición y devuelve su identificador en la respuesta.
  // Registra también los errores y rechazos que terminan antes del interceptor.
  use(req: any, res: any, next: () => void) {
    // No confiar en identificadores ni cabeceras X-Forwarded-For enviados por el cliente.
    const contexto: ContextoAuditoria = {
      solicitudId: randomUUID(), metodo: req.method, ruta: req.path,
      ip: req.ip || req.socket?.remoteAddress || '', agente: String(req.headers['user-agent'] || '').slice(0, 512), eventos: 0,
    };
    req.auditoria = contexto;
    res.setHeader('X-Solicitud-Id', contexto.solicitudId);
    res.once('finish', () => {
      // Incluye rechazos de los guards, que ocurren antes del interceptor.
      if (res.statusCode < 400 || req.method === 'OPTIONS') return;
      if (req.user) contexto.usuario = actor(req.user);
      void this.auditoria.registrar(contexto, {
        accion: 'SOLICITUD', resultado: res.statusCode === 401 || res.statusCode === 403 ? 'DENEGADO' : 'ERROR',
        codigoHttp: res.statusCode, recurso: 'HTTP', cambios: [],
      }).catch(() => this.logger.error(`No se pudo registrar el intento ${contexto.solicitudId}; HTTP ${res.statusCode}. Revisar disponibilidad de auditoría.`));
    });
    contextoAuditoria.run(contexto, next);
  }
}
// Extrae el identificador, nombre y rol del usuario autenticado para conservar su identidad en
// los eventos de la solicitud.
export const actor = (user: any) => ({ id: String(user.userId || user._id), nombre: user.nombre || user.email || '', rol: user.role || '' });

@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  // Recibe las dependencias que permiten registrar eventos y, en el interceptor, gestionar la
  // conexión y las transacciones de MongoDB.
  constructor(@InjectConnection() private readonly conexion: Connection, private readonly auditoria: AuditoriaService) {}
  // Ejecuta la petición dentro del contexto de auditoría y agrupa las escrituras y sus eventos
  // en una transacción. Confirma al terminar o revierte si ocurre un error.
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest(), res = context.switchToHttp().getResponse();
    const registro: ContextoAuditoria = req.auditoria;
    if (!registro || req.method === 'OPTIONS') return next.handle();
    return defer(() => contextoAuditoria.run(registro, async () => {
      if (req.user) registro.usuario = actor(req.user);
      if (req.method === 'DELETE' && /^\/(alertas|maltratos|conflictos)(\/|$)/.test(req.path)) {
        throw new ForbiddenException('Los expedientes no se pueden eliminar.');
      }
      const escritura = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
      const session = escritura ? await this.conexion.startSession() : undefined;
      try {
        // Algunos controladores envían archivos con @Res antes de devolver el
        // control. Registrar el inicio ANTES de permitir su lectura/descarga.
        if (!escritura) await this.auditoria.registrar(registro, {
          accion: /exportar|\/pdf(?:\/|$)|descargar/.test(req.path) ? 'DESCARGAR' : 'CONSULTAR',
          resultado: 'INICIADO', recurso: 'HTTP', cambios: [],
        });
        if (session) {
          registro.session = session;
          session.startTransaction({ readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
        }
        const resultado = await lastValueFrom(next.handle());
        // Evento HTTP también cuando solo cambiaron credenciales o no hubo campos diferentes.
        await this.auditoria.registrar(registro, {
          accion: req.path.startsWith('/auth/login') ? 'INICIAR_SESION' : req.path.startsWith('/auth/logout') ? 'CERRAR_SESION'
            : /exportar|\/pdf(?:\/|$)|descargar/.test(req.path) ? 'DESCARGAR' : escritura ? 'SOLICITUD' : 'CONSULTAR',
          resultado: 'EXITOSO', codigoHttp: res.statusCode, recurso: 'HTTP', cambios: [], eventosDeDatos: registro.eventos,
        }, escritura);
        if (session) await session.commitTransaction();
        return resultado;
      } catch (error) {
        if (session?.inTransaction()) await session.abortTransaction();
        // No se reintenta el handler: podría haber subido archivos a Drive.
        if ([20, 263].includes(error.code)) throw new ServiceUnavailableException('MongoDB debe operar como replica set para conservar la auditoría.');
        throw error;
      } finally {
        registro.session = undefined;
        if (session) await session.endSession();
      }
    }));
  }
}
