import { CallHandler, ExecutionContext, ForbiddenException, Injectable, Logger, NestInterceptor, NestMiddleware, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { defer, lastValueFrom } from 'rxjs';
import { contextoAuditoria, ContextoAuditoria } from './auditoria-core';
import { AuditoriaService } from './auditoria.service';

// originalUrl conserva la ruta completa aunque Express monte el middleware en '/'.
// Se excluye la consulta para no copiar datos sensibles ni credenciales de la URL.
const rutaSolicitud = (req: any): string =>
  String(req.originalUrl || `${req.baseUrl || ''}${req.path || '/'}`).split('?')[0];

// Solo las lecturas de negocio generan bitácora; catálogos y cargas automáticas no.
function accionLectura(ruta: string): string | undefined {
  if (/exportar|\/pdf(?:\/|$)|descargar/.test(ruta)) return 'DESCARGAR';
  if (/^\/busquedas\/expediente\//.test(ruta) ||
      /^\/(alertas|maltratos|conflictos)\/(gestion\/[^/]+|buscar\/[^/]+|by-deic\/[^/]+|[a-f\d]{24})\/?$/i.test(ruta) ||
      /^\/alertas\/por-expedienteMP\/?$/.test(ruta) ||
      /^\/documentacion-inicial\/(para-caso\/[^/]+\/[^/]+|[a-f\d]{24}(?:\/(plan|rubrica))?)\/?$/i.test(ruta) ||
      /^\/informes\/(?!pendientes(?:\/|$))[^/]+\/?$/.test(ruta) ||
      /^\/auditoria\/[^/]+\/?$/.test(ruta)) return 'CONSULTAR';
  return undefined;
}

// La búsqueda devuelve resúmenes; solo el detalle abierto identifica un expediente
// consultado. Se usan los datos autorizados del servidor, nunca el cuerpo del cliente.
function expedienteConsultado(ruta: string, resultado: any): Record<string, string> {
  const detalle = /^\/busquedas\/expediente\/(alerta|maltrato|conflicto)\/([^/]+)\/?$/i.exec(ruta);
  if (!detalle || !resultado || Array.isArray(resultado)) return {};
  const recursos = { alerta: 'CasosAlerta', maltrato: 'CasosMaltrato', conflicto: 'CasosConflicto' };
  return {
    recurso: recursos[detalle[1].toLowerCase()], recursoId: String(resultado._id || detalle[2]),
    casoId: String(resultado._id || detalle[2]), numeroDeic: resultado.numeroDeic || '',
  };
}

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
      solicitudId: randomUUID(), metodo: req.method, ruta: rutaSolicitud(req),
      ip: req.ip || req.socket?.remoteAddress || '', agente: String(req.headers['user-agent'] || '').slice(0, 512), eventos: 0,
    };
    req.auditoria = contexto;
    res.setHeader('X-Solicitud-Id', contexto.solicitudId);
    res.once('finish', () => {
      // Incluye rechazos de los guards, que ocurren antes del interceptor.
      if (res.statusCode < 400 || req.method === 'OPTIONS') return;
      // Una sesión ausente al abrir el login es normal. Rutas inexistentes y errores
      // de cargas automáticas van al registro técnico, sin llenar la bitácora.
      if (contexto.ruta === '/auth/session' && res.statusCode === 401) return;
      if ((!req.route && !req.user) ||
          (req.method === 'GET' && !accionLectura(contexto.ruta) && res.statusCode !== 401 && res.statusCode !== 403)) {
        this.logger.warn(`Solicitud ${contexto.solicitudId}: ${req.method} ${contexto.ruta}; HTTP ${res.statusCode}.`);
        return;
      }
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
    registro.ruta = rutaSolicitud(req);
    return defer(() => contextoAuditoria.run(registro, async () => {
      if (req.user) registro.usuario = actor(req.user);
      if (req.method === 'DELETE' && /^\/(alertas|maltratos|conflictos)(\/|$)/.test(registro.ruta)) {
        throw new ForbiddenException('Los expedientes no se pueden eliminar.');
      }
      const escritura = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
      const lectura = accionLectura(registro.ruta);
      const sesionUsuario = registro.ruta === '/auth/login' ? 'INICIAR_SESION'
        : registro.ruta === '/auth/logout' ? 'CERRAR_SESION' : undefined;
      const session = escritura ? await this.conexion.startSession() : undefined;
      try {
        // Algunos controladores envían archivos con @Res antes de devolver el
        // control. Registrar el inicio ANTES de permitir su lectura/descarga.
        if (!escritura && lectura === 'DESCARGAR') await this.auditoria.registrar(registro, {
          accion: lectura,
          resultado: 'INICIADO', recurso: 'HTTP', cambios: [],
        });
        if (session) {
          registro.session = session;
          session.startTransaction({ readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
        }
        const resultado = await lastValueFrom(next.handle());
        // Los cambios ya tienen actor, ruta y solicitud: no duplicar con un resumen HTTP.
        // Una descarga conserva INICIADO; no acredita recepción del archivo en el cliente.
        if (registro.ruta !== '/auth/logout' && registro.ruta !== '/auth/actividad' &&
            (sesionUsuario || (escritura && !registro.eventos) || (!escritura && lectura && lectura !== 'DESCARGAR'))) await this.auditoria.registrar(registro, {
          accion: sesionUsuario || (escritura ? 'SOLICITUD' : lectura),
          resultado: 'EXITOSO', codigoHttp: res.statusCode, recurso: 'HTTP', cambios: [], eventosDeDatos: registro.eventos,
          ...(!escritura ? expedienteConsultado(registro.ruta, resultado) : {}),
          ...(registro.sesion ? { sesion: registro.sesion } : {}),
          ...(sesionUsuario ? { recurso: 'Usuario', recursoId: registro.usuario?.id || '' } : {}),
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
