import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { Schema } from 'mongoose';
import { AUDIT_COLLECTION, cambiosEntre, contextoAuditoria, datosAuditables, MODELOS_AUDITADOS, nuevoEvento } from './auditoria-core';

const ANTES = Symbol('auditoriaAntes');
// Instala los hooks de Mongoose que registran cambios con la sesión de auditoría y bloquean
// operaciones masivas o borrados de expedientes no permitidos.
export function auditoriaPlugin(schema: Schema) {
  // Plugin de conexión: los esquemas de pruebas aisladas no lo instalan implícitamente.
  // Identifica si el modelo pertenece al conjunto de recursos que requieren captura de cambios
  // en la bitácora.
  const esModelo = (modelo: any) => MODELOS_AUDITADOS.has(modelo?.modelName);
  // Obtiene el contexto activo y exige una transacción antes de escribir en un modelo auditado.
  // Rechaza guardar sin esa protección.
  function sesion(modelo: any) {
    if (!esModelo(modelo)) return;
    const contexto = contextoAuditoria.getStore();
    if (!contexto?.session || !contexto.session.inTransaction()) {
      throw new ServiceUnavailableException('La escritura requiere una transacción de auditoría activa.');
    }
    return contexto;
  }
  // Compara los datos persistidos antes y después de la operación e inserta un evento firmado en
  // la misma transacción cuando existen diferencias.
  async function registrar(modelo: any, anterior: any, nuevo: any) {
    const contexto = sesion(modelo);
    if (!contexto) return;
    const cambios = cambiosEntre(datosAuditables(anterior), datosAuditables(nuevo));
    if (!cambios.length) return;
    const dato = nuevo || anterior;
    const contenido = {
      accion: !anterior ? 'CREAR' : !nuevo ? 'ELIMINAR' : 'MODIFICAR', resultado: 'EXITOSO',
      recurso: modelo.modelName, recursoId: String(dato._id),
      numeroDeic: dato.numeroDeic || '', casoId: String(dato.casoId || dato._id),
      cambios,
    };
    await modelo.db.collection(AUDIT_COLLECTION).insertOne(
      nuevoEvento(contexto, contenido, process.env.AUDIT_HMAC_KEY), { session: contexto.session },
    );
    contexto.eventos++;
  }
  // Todas las lecturas del handler comparten el snapshot de la transacción.
  for (const op of ['find', 'findOne', 'countDocuments', 'distinct'] as const) {
    schema.pre(op, function () {
      const query: any = this, contexto = contextoAuditoria.getStore();
      if (esModelo(query.model) && contexto?.session) query.session(contexto.session);
    });
  }
  schema.pre('aggregate', function () {
    const aggregate: any = this, contexto = contextoAuditoria.getStore();
    if (esModelo(aggregate._model) && contexto?.session) aggregate.session(contexto.session);
  });
  schema.pre('save', async function () {
    const doc: any = this, contexto = sesion(doc.constructor);
    if (!contexto) return;
    doc.$session(contexto.session);
    doc.$locals[ANTES] = doc.isNew ? null : await doc.constructor.collection.findOne({ _id: doc._id }, { session: contexto.session });
  });
  schema.post('save', async function (doc: any) {
    if (!esModelo(doc.constructor)) return;
    const contexto = sesion(doc.constructor);
    const nuevo = await doc.constructor.collection.findOne({ _id: doc._id }, { session: contexto.session });
    await registrar(doc.constructor, doc.$locals[ANTES], nuevo);
    delete doc.$locals[ANTES];
  });
  for (const op of ['findOneAndUpdate', 'updateOne', 'deleteOne', 'findOneAndDelete'] as const) {
    schema.pre(op, async function () {
      const query: any = this;
      if (!esModelo(query.model)) return;
      if (['deleteOne', 'findOneAndDelete'].includes(op) && query.model.modelName.startsWith('Casos')) {
        throw new ForbiddenException('Los expedientes no se pueden eliminar.');
      }
      const contexto = sesion(query.model);
      if (query.getOptions().upsert || Array.isArray(query.getUpdate?.())) {
        throw new ForbiddenException('Upsert y actualizaciones por pipeline requieren un flujo auditado explícito.');
      }
      query.session(contexto.session);
      const filtro = query.getFilter();
      const existente = await query.model.findOne(filtro).sort(query.getOptions().sort || {}).session(contexto.session).select('_id').lean();
      query[ANTES] = existente ? await query.model.collection.findOne({ _id: existente._id }, { session: contexto.session }) : null;
      if (existente) query.setQuery({ $and: [filtro, { _id: existente._id }] });
    });
    schema.post(op, async function () {
      const query: any = this;
      if (!esModelo(query.model)) return;
      const contexto = sesion(query.model);
      // La clave no cambia aunque el filtro incluya el estado anterior.
      const anterior = query[ANTES];
      const nuevo = anterior ? await query.model.collection.findOne({ _id: anterior._id }, { session: contexto.session }) : null;
      await registrar(query.model, anterior, nuevo);
    });
  }
  // Evitar vías de escritura sin captura individual y operaciones masivas sin auditar.
  for (const op of ['updateMany', 'deleteMany', 'replaceOne', 'findOneAndReplace', 'insertMany', 'bulkWrite'] as const) {
    (schema as any).pre(op, function (next: any) {
      const objeto: any = this, modelo = typeof objeto === 'function' ? objeto : objeto.model;
      if (esModelo(modelo)) return next(new ForbiddenException('Esta operación masiva no está habilitada para recursos auditados.'));
      next();
    });
  }
  schema.pre('deleteOne', { document: true, query: false }, function () {
    if (esModelo(this.constructor)) throw new ForbiddenException('Utilice una operación individual auditada.');
  });
}
