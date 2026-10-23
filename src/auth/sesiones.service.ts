import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Usuario, UsuarioDocument } from './entities/auth.entity';
import { AUDIT_COLLECTION, contextoAuditoria, nuevoEvento } from '../auditoria/auditoria-core';

export const INACTIVIDAD_MS = 15 * 60 * 1000;

@Injectable()
export class SesionesService implements OnApplicationBootstrap, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private revisando = false;
  private logger = new Logger(SesionesService.name);
  constructor(@InjectModel(Usuario.name) private usuarios: Model<UsuarioDocument>) {}

  // La base decide el vencimiento; las peticiones automáticas no renuevan actividad.
  async validar(user: any) {
    if (!user.sesionId || !user.sesionExpira || new Date(user.sesionExpira).getTime() <= Date.now()) {
      if (user.sesionId) await this.cerrar(user, 'INACTIVIDAD');
      throw new UnauthorizedException('La sesión terminó por inactividad.');
    }
  }

  // Solo se llama ante actividad explícita del navegador y nunca revive una sesión vencida.
  async actividad(userId: string, sesionId: string) {
    const ahora = new Date();
    const expira = new Date(ahora.getTime() + INACTIVIDAD_MS);
    const user = await this.usuarios.findOneAndUpdate({ _id: userId, sesionId, sesionExpira: { $gt: ahora }, activo: { $ne: false } },
      { $set: { sesionUltimaActividad: ahora, sesionExpira: expira } }, { new: true }).exec();
    if (!user) throw new UnauthorizedException('La sesión ya no está activa.');
    return { expiresAt: expira.getTime(), idleTimeoutMs: INACTIVIDAD_MS };
  }

  // Cierra exactamente la sesión leída y firma su duración en la misma transacción.
  // La condición evita cerrar una sesión nueva o registrar dos cierres concurrentes.
  async cerrar(user: any, motivo: 'MANUAL' | 'INACTIVIDAD' | 'NUEVO_INICIO') {
    if (!user?.sesionId) return;
    const existente = contextoAuditoria.getStore();
    const propia = !existente?.session;
    const session = propia ? await this.usuarios.db.startSession() : existente.session;
    const contexto = { ...existente, solicitudId: existente?.solicitudId || randomUUID(),
      usuario: { id: String(user._id), nombre: user.nombre, rol: user.role },
      metodo: existente?.metodo || 'INTERNO', ruta: existente?.ruta || '/auth/inactividad',
      ip: existente?.ip || '', agente: existente?.agente || '', eventos: 0, session };
    return contextoAuditoria.run(contexto, async () => {
      try {
        if (propia) session.startTransaction({ readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
        const filtro: any = { _id: user._id, sesionId: user.sesionId, token: user.token };
        if (motivo === 'INACTIVIDAD') filtro.sesionExpira = { $lte: new Date() };
        const cerrada = await this.usuarios.findOneAndUpdate(filtro,
          { $set: { token: null }, $unset: { sesionId: 1, sesionInicio: 1, sesionUltimaActividad: 1, sesionExpira: 1 } }, { new: false }).exec();
        if (cerrada) {
          const fin = motivo === 'INACTIVIDAD' ? new Date(cerrada.sesionExpira) : new Date();
          const inicio = new Date(cerrada.sesionInicio);
          await this.usuarios.db.collection(AUDIT_COLLECTION).insertOne(nuevoEvento(contexto, {
            accion: 'CERRAR_SESION', resultado: 'EXITOSO', recurso: 'Usuario', recursoId: String(user._id), cambios: [],
            sesion: { id: cerrada.sesionId, inicio, fin, ultimaActividad: cerrada.sesionUltimaActividad,
              duracionSegundos: Math.max(0, Math.floor((fin.getTime() - inicio.getTime()) / 1000)), motivo },
          }, process.env.AUDIT_HMAC_KEY), { session });
        }
        if (propia) await session.commitTransaction();
      } catch (error) {
        if (propia && session.inTransaction()) await session.abortTransaction();
        throw error;
      } finally {
        if (propia) await session.endSession();
      }
    });
  }

  // También deja constancia cuando el navegador está cerrado; el fin es el vencimiento
  // calculado, aunque el proceso detecte el cierre unos segundos después o tras reiniciar.
  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.cerrarVencidas(), 30000);
    this.timer.unref();
    void this.cerrarVencidas();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async cerrarVencidas() {
    if (this.revisando) return;
    this.revisando = true;
    try {
      const users = await this.usuarios.find({ sesionId: { $exists: true }, sesionExpira: { $lte: new Date() } }).limit(100).exec();
      for (const user of users) await this.cerrar(user, 'INACTIVIDAD');
    } catch { this.logger.error('No se pudieron cerrar las sesiones vencidas; se reintentará en la siguiente revisión.'); }
    finally { this.revisando = false; }
  }
}
