import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AUDIT_COLLECTION, ContextoAuditoria, nuevoEvento, verificarFirma } from './auditoria-core';

@Injectable()
export class AuditoriaService implements OnModuleInit {
  constructor(@InjectConnection() private readonly conexion: Connection) {}

  async onModuleInit() {
    if (!process.env.AUDIT_HMAC_KEY || Buffer.byteLength(process.env.AUDIT_HMAC_KEY) < 32) {
      throw new Error('Configure AUDIT_HMAC_KEY con al menos 32 bytes y consérvela en un almacén de secretos.');
    }
    const hello = await this.conexion.db.command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') {
      throw new Error('La auditoría requiere MongoDB replica set o Atlas para guardar el cambio y su bitácora en una transacción. No se habilitan escrituras sin auditoría.');
    }
    const estado = await this.conexion.db.command({ connectionStatus: 1, showPrivileges: true });
    const privilegios = estado.authInfo?.authenticatedUserPrivileges;
    if (!estado.authInfo?.authenticatedUsers?.length || !Array.isArray(privilegios)) {
      throw new Error('La auditoría requiere autenticación MongoDB y una cuenta de aplicación con permisos limitados.');
    }
    const prohibidos = new Set(['anyAction', 'update', 'remove', 'dropCollection', 'dropDatabase', 'renameCollectionSameDB', 'collMod', 'convertToCapped', 'emptycapped', 'createIndex', 'dropIndex']);
    const escalanPermisos = new Set(['anyAction', 'grantRole', 'createRole', 'updateRole', 'createUser', 'impersonate']);
    if (privilegios.some(p => {
      const r = p.resource;
      return p.actions.some(a => escalanPermisos.has(a)) ||
        ((r.anyResource || ((r.db === '' || r.db === this.conexion.name) && (r.collection === '' || r.collection === AUDIT_COLLECTION))) &&
          p.actions.some(a => prohibidos.has(a)));
    })) throw new Error('La cuenta MongoDB puede modificar o borrar auditoría. Use el rol SGIC descrito en docs/bitacora-auditoria.md; no readWrite/root.');
    const collection = this.conexion.collection(AUDIT_COLLECTION);
    const indices = await collection.indexes();
    if (indices.some(i => i.expireAfterSeconds !== undefined) ||
        !indices.some(i => i.unique && JSON.stringify(i.key) === JSON.stringify({ eventoId: 1 }))) {
      throw new Error('La bitácora requiere un índice único por eventoId y ningún índice TTL. Ejecute scripts/configurar-auditoria.mongosh.js como administrador.');
    }
  }

  async registrar(contexto: ContextoAuditoria, contenido: Record<string, any>, transaccional = false) {
    const evento = nuevoEvento(contexto, contenido, process.env.AUDIT_HMAC_KEY);
    await this.conexion.collection(AUDIT_COLLECTION).insertOne(evento,
      transaccional ? { session: contexto.session } : { writeConcern: { w: 'majority' } });
    return evento;
  }

  construirFiltro(query: Record<string, string>) {
    const permitidos = new Set(['numeroDeic', 'usuarioId', 'usuario', 'recurso', 'recursoId', 'accion', 'resultado', 'solicitudId', 'desde', 'hasta', 'campo', 'anterior', 'nuevo', 'pagina', 'limite']);
    if (Object.entries(query).some(([k, v]) => !permitidos.has(k) || typeof v !== 'string' || v.length > 512)) {
      throw new BadRequestException('Los filtros deben ser textos de hasta 512 caracteres; no se admiten operadores de base de datos.');
    }
    const filtro: any = {};
    for (const [parametro, campo] of Object.entries({ numeroDeic: 'numeroDeic', usuarioId: 'usuario.id', recurso: 'recurso', recursoId: 'recursoId', accion: 'accion', resultado: 'resultado', solicitudId: 'solicitudId' })) {
      if (query[parametro]) filtro[campo] = query[parametro];
    }
    // El nombre queda congelado al actuar; no se sustituye con el nombre actual.
    if (query.usuario) filtro['usuario.nombre'] = { $regex: query.usuario.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const fecha = (valor: string) => {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(valor) || !Number.isFinite(Date.parse(valor))) {
        throw new BadRequestException('Las fechas deben indicar hora y zona horaria ISO 8601.');
      }
      return new Date(valor);
    };
    if (query.desde || query.hasta) filtro.fecha = {
      ...(query.desde ? { $gte: fecha(query.desde) } : {}), ...(query.hasta ? { $lte: fecha(query.hasta) } : {}),
    };
    if (filtro.fecha?.$gte > filtro.fecha?.$lte) throw new BadRequestException('El rango de fechas no es válido.');
    if (query.campo || query.anterior || query.nuevo) filtro.cambios = { $elemMatch: {
      ...(query.campo ? { campo: query.campo } : {}),
      ...(query.anterior ? { anterior: query.anterior } : {}), ...(query.nuevo ? { nuevo: query.nuevo } : {}),
    } };
    return filtro;
  }

  async buscar(query: Record<string, string>) {
    const pagina = Number(query.pagina || 1), limite = Number(query.limite || 25);
    if (!Number.isInteger(pagina) || pagina < 1 || pagina > 10000 || !Number.isInteger(limite) || limite < 1 || limite > 100) {
      throw new BadRequestException('Paginación inválida (máximo 100 registros por página).');
    }
    const filtro = this.construirFiltro(query), collection = this.conexion.collection(AUDIT_COLLECTION);
    const [registros, total] = await Promise.all([
      collection.find(filtro).sort({ fecha: -1, eventoId: -1 }).skip((pagina - 1) * limite).limit(limite).maxTimeMS(10000).toArray(),
      collection.countDocuments(filtro, { maxTimeMS: 10000 }),
    ]);
    return { registros: registros.map(e => this.presentar(e)), total, pagina, limite };
  }
  private presentar(evento: any) {
    const integridadValida = verificarFirma(evento, process.env.AUDIT_HMAC_KEY);
    const { _id, firma, ...datos } = evento;
    return { ...datos, integridadValida };
  }
  async detalle(eventoId: string) {
    const evento = await this.conexion.collection(AUDIT_COLLECTION).findOne({ eventoId });
    if (!evento) throw new NotFoundException('Evento no encontrado.');
    return this.presentar(evento);
  }
}
