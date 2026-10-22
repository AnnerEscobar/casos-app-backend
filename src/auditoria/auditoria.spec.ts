import 'reflect-metadata';
import { createConnection, Schema, Types } from 'mongoose';
import { lastValueFrom, defer, of, throwError } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AUDIT_COLLECTION, cambiosEntre, ContextoAuditoria, contextoAuditoria, datosAuditables, nuevoEvento, verificarFirma } from './auditoria-core';
import { auditoriaPlugin } from './auditoria-plugin';
import { AuditoriaService } from './auditoria.service';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaInterceptor, AuditoriaMiddleware } from './auditoria-http';
import { RolesGuard } from '../auth/Guards/roles.guard';
import { JwtAuthGuard } from '../auth/Guards/jwt-auth.guard';
import { UserRole } from '../auth/enums/user-role.enum';
import { CasosAlertaSchema } from '../casos-alerta/entities/casos-alerta.entity';
import { CasosMaltratoSchema } from '../casos-maltrato/entities/casos-maltrato.entity';
import { CasosConflictoSchema } from '../casos-conflicto/entities/casos-conflicto.entity';
import { DocumentacionInicialSchema } from '../documentacion-inicial/entities/documentacion-inicial.entity';
import { UsuarioSchema } from '../auth/entities/auth.entity';
import { CaratulaSchema } from '../caratulas/entities/caratula.entity';
import { InformeSchema } from '../informes/entities/informe.entity';
import { SolicitudAccesoSchema } from '../busquedas/solicitud-acceso.schema';

const clave = 'prueba-auditoria-no-usar-en-produccion-123456';
const contexto = (): ContextoAuditoria => ({ solicitudId: 'solicitud', usuario: { id: 'actor', nombre: 'María Pérez', rol: 'Investigador' }, metodo: 'PATCH', ruta: '/alertas/seguimiento/DEIC', ip: '127.0.0.1', agente: 'Prueba', eventos: 0 });
describe('Eventos, búsquedas e integridad', () => {
  beforeEach(() => { process.env.AUDIT_HMAC_KEY = clave; });
  it('identifica exactamente Localizado → Remitido, incluyendo nuevos seguimientos', () => {
    const cambios = cambiosEntre(datosAuditables({ estadoInvestigacion: 'Localizado', seguimientos: [] }), datosAuditables({ estadoInvestigacion: 'Remitido', seguimientos: [{ nuevoEstado: 'Remitido', registradoPor: new Types.ObjectId() }] }));
    expect(cambios).toContainEqual({ campo: 'estadoInvestigacion', anterior: 'Localizado', nuevo: 'Remitido' });
    expect(cambios).toContainEqual({ campo: 'seguimientos.0.nuevoEstado', anterior: null, nuevo: 'Remitido' });
  });
  it('no pierde ceros, falsos, eliminaciones ni tildes', () => {
    expect(cambiosEntre({ activo: true, nombre: 'María', cantidad: 1 }, { activo: false, nombre: null, cantidad: 0 })).toEqual([
      { campo: 'activo', anterior: true, nuevo: false }, { campo: 'cantidad', anterior: 1, nuevo: 0 }, { campo: 'nombre', anterior: 'María', nuevo: null },
    ]);
  });
  it('no registra contraseñas, tokens ni metadatos auxiliares anidados', () => {
    const limpio = datosAuditables({ password: 'secreto', token: 'secreto', persona: { nombre: 'Ana', authorization: 'secreto' }, _presentacionTextos: { original: 'secreto' }, updatedAt: new Date() });
    expect(limpio).toEqual({ persona: { nombre: 'Ana' } });
  });
  it('verifica la firma después de BSON/JSON y detecta cambios de autor, hora y valores', () => {
    const evento = nuevoEvento(contexto(), { cambios: [{ campo: 'estadoInvestigacion', anterior: 'Localizado', nuevo: 'Remitido' }] }, clave);
    expect(verificarFirma({ ...JSON.parse(JSON.stringify(evento)), _id: new Types.ObjectId() }, clave)).toBe(true);
    for (const cambio of [{ usuario: { id: 'otro' } }, { fecha: new Date(0) }, { cambios: [] }, { password: 'dato-agregado' }, { firma: 'x' }]) {
      expect(verificarFirma({ ...evento, ...cambio }, clave)).toBe(false);
    }
    expect(verificarFirma(evento, 'otra-clave')).toBe(false);
  });
  it('busca anterior y nuevo dentro del mismo cambio, con rango de fechas explícito', () => {
    const servicio = new AuditoriaService({} as any);
    const filtro = servicio.construirFiltro({ numeroDeic: 'DEIC', campo: 'estadoInvestigacion', anterior: 'Localizado', nuevo: 'Remitido', desde: '2026-10-22T00:00:00-06:00', hasta: '2026-10-22T23:59:59-06:00' });
    expect(filtro.cambios.$elemMatch).toEqual({ campo: 'estadoInvestigacion', anterior: 'Localizado', nuevo: 'Remitido' });
    expect(filtro.fecha.$gte.toISOString()).toBe('2026-10-22T06:00:00.000Z');
  });
  it('escapa nombres y rechaza inyección de operadores, filtros desconocidos y fechas ambiguas', () => {
    const servicio = new AuditoriaService({} as any);
    expect(servicio.construirFiltro({ usuario: 'Ana.*' })['usuario.nombre'].$regex).toBe('Ana\\.\\*');
    expect(() => servicio.construirFiltro({ numeroDeic: { $ne: '' } } as any)).toThrow();
    expect(() => servicio.construirFiltro({ '$where': 'algo' })).toThrow();
    expect(() => servicio.construirFiltro({ desde: '2026-10-22' })).toThrow();
    expect(() => servicio.construirFiltro({ desde: '2026-10-23T00:00:00Z', hasta: '2026-10-22T00:00:00Z' })).toThrow();
  });
  it('limita paginación antes de consultar MongoDB', async () => {
    const servicio = new AuditoriaService({} as any);
    await expect(servicio.buscar({ limite: '101' })).rejects.toThrow();
    await expect(servicio.buscar({ pagina: '-1' })).rejects.toThrow();
  });
  it('solo permite consultas de Administrador/Jefe y no expone rutas de edición', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AuditoriaController)).toEqual([JwtAuthGuard, RolesGuard]);
    const guard = new RolesGuard(new Reflector());
    for (const rol of Object.values(UserRole)) {
      const ctx = { getClass: () => AuditoriaController, getHandler: () => AuditoriaController.prototype.buscar, switchToHttp: () => ({ getRequest: () => ({ user: { role: rol } }) }) } as any;
      if ([UserRole.ADMIN, UserRole.JEFE].includes(rol)) expect(guard.canActivate(ctx)).toBe(true);
      else expect(() => guard.canActivate(ctx)).toThrow();
    }
    expect(Object.getOwnPropertyNames(AuditoriaController.prototype).sort()).toEqual(['buscar', 'constructor', 'detalle']);
  });
});

describe('Middleware real de Mongoose con driver simulado', () => {
  const conexion = createConnection();
  const schema = new Schema({ numeroDeic: String, estadoInvestigacion: String, nombre: String }, { bufferCommands: false });
  schema.plugin(auditoriaPlugin);
  const Modelo = conexion.model('CasosAlerta', schema);
  let almacenado: any, eventos: any[], sesion: any;
  beforeEach(() => {
    process.env.AUDIT_HMAC_KEY = clave; almacenado = null; eventos = [];
    sesion = { inTransaction: () => true, hasEnded: false };
    jest.spyOn(Modelo.collection, 'insertOne').mockImplementation(async (doc: any) => { almacenado = { ...doc }; return { acknowledged: true, insertedId: doc._id } as any; });
    jest.spyOn(Modelo.collection, 'findOne').mockImplementation(async () => almacenado && { ...almacenado });
    jest.spyOn(Modelo.collection, 'updateOne').mockImplementation(async (_f: any, update: any) => { Object.assign(almacenado, update.$set); return { acknowledged: true, matchedCount: 1, modifiedCount: 1 } as any; });
    jest.spyOn(Modelo.collection, 'findOneAndUpdate').mockImplementation(async (_f: any, update: any) => { Object.assign(almacenado, update.$set); return { ...almacenado }; });
    jest.spyOn(conexion.collection(AUDIT_COLLECTION), 'insertOne').mockImplementation(async (evento: any, opciones: any) => { expect(opciones.session).toBe(sesion); eventos.push(evento); return { acknowledged: true, insertedId: evento.eventoId } as any; });
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => conexion.close());
  const ejecutar = (fn: () => any) => contextoAuditoria.run({ ...contexto(), session: sesion }, fn);
  it('guarda expediente y evento con la misma sesión; la modificación tiene los dos estados reales', async () => {
    await ejecutar(async () => {
      const doc = await Modelo.create({ numeroDeic: 'DEIC', estadoInvestigacion: 'Localizado' });
      doc.estadoInvestigacion = 'Remitido'; await doc.save();
    });
    expect(eventos).toHaveLength(2);
    expect(eventos[1].usuario).toEqual(contexto().usuario);
    expect(eventos[1].cambios).toContainEqual({ campo: 'estadoInvestigacion', anterior: 'Localizado', nuevo: 'Remitido' });
    expect(verificarFirma(eventos[1], clave)).toBe(true);
    expect((Modelo.collection.updateOne as jest.Mock).mock.calls[0][2].session).toBe(sesion);
  });
  it('cubre actualizaciones atómicas y no utiliza el filtro de estado anterior para recuperar el resultado', async () => {
    await ejecutar(async () => {
      await Modelo.create({ numeroDeic: 'DEIC', estadoInvestigacion: 'Localizado' });
      await Modelo.findOneAndUpdate({ numeroDeic: 'DEIC', estadoInvestigacion: 'Localizado' }, { $set: { estadoInvestigacion: 'Remitido' } });
    });
    expect(eventos[1].cambios).toContainEqual({ campo: 'estadoInvestigacion', anterior: 'Localizado', nuevo: 'Remitido' });
  });
  it('rechaza escritura fuera de una transacción, borrado de casos y operaciones masivas', async () => {
    await expect(Modelo.create({ numeroDeic: 'DEIC' })).rejects.toThrow('transacción');
    await expect(ejecutar(() => Modelo.deleteOne({ numeroDeic: 'DEIC' }).exec())).rejects.toThrow('no se pueden eliminar');
    await expect(ejecutar(() => Modelo.updateMany({}, { nombre: 'cambio' }).exec())).rejects.toThrow('masiva');
    await expect(ejecutar(() => Modelo.insertMany([{ numeroDeic: 'DEIC' }]))).rejects.toThrow('masiva');
  });
  it('propaga un fallo al insertar auditoría para que se aborte la transacción', async () => {
    (conexion.collection(AUDIT_COLLECTION).insertOne as jest.Mock).mockRejectedValueOnce(new Error('Auditoría no disponible'));
    await expect(ejecutar(() => Modelo.create({ numeroDeic: 'DEIC' }))).rejects.toThrow('Auditoría no disponible');
  });
  it('bloquea también bulkWrite, reemplazos, upsert y borrado desde documento', async () => {
    await expect(ejecutar(() => Modelo.bulkWrite([{ deleteOne: { filter: {} } }]))).rejects.toThrow('masiva');
    await expect(ejecutar(() => Modelo.replaceOne({}, { numeroDeic: 'DEIC' }).exec())).rejects.toThrow('masiva');
    await expect(ejecutar(() => Modelo.findOneAndUpdate({}, { numeroDeic: 'DEIC' }, { upsert: true }).exec())).rejects.toThrow('Upsert');
    const doc = new Modelo({ numeroDeic: 'DEIC' });
    await expect(ejecutar(() => doc.deleteOne())).rejects.toThrow('operación individual');
  });
});

describe('Instalación en los ocho esquemas reales y coexistencia con mayúsculas', () => {
  it.each([
    ['CasosAlerta', CasosAlertaSchema], ['CasosMaltrato', CasosMaltratoSchema], ['CasosConflicto', CasosConflictoSchema],
    ['DocumentacionInicial', DocumentacionInicialSchema], ['Usuario', UsuarioSchema], ['Caratula', CaratulaSchema], ['Informe', InformeSchema], ['SolicitudAcceso', SolicitudAccesoSchema],
  ] as const)('audita creación real de %s con la sesión y sin credenciales', async (nombre, original) => {
    process.env.AUDIT_HMAC_KEY = clave;
    const c = createConnection(); c.plugin(auditoriaPlugin);
    const s = original.clone(); s.set('bufferCommands', false);
    const M = c.model(nombre, s);
    let persistido: any, registro: any;
    const sesion: any = { inTransaction: () => true, hasEnded: false };
    jest.spyOn(M.collection, 'insertOne').mockImplementation(async (doc: any) => { persistido = { ...doc }; return { acknowledged: true, insertedId: doc._id } as any; });
    jest.spyOn(M.collection, 'findOne').mockImplementation(async () => persistido);
    jest.spyOn(c.collection(AUDIT_COLLECTION), 'insertOne').mockImplementation(async (evento: any) => { registro = evento; return { acknowledged: true, insertedId: evento.eventoId } as any; });
    try {
      // Se prueban los hooks sobre esquemas reales, no los requisitos de cada formulario.
      await contextoAuditoria.run({ ...contexto(), session: sesion }, () => new M({ numeroDeic: 'DEIC', nombre: 'María', password: 'secreto', token: 'secreto' }).save({ validateBeforeSave: false }));
      expect(registro.recurso).toBe(nombre); expect(registro.accion).toBe('CREAR');
      expect(JSON.stringify(registro)).not.toContain('secreto');
      expect(verificarFirma(registro, clave)).toBe(true);
      if (nombre === 'Usuario') expect(persistido.nombre).toBe('MARÍA');
    } finally { jest.restoreAllMocks(); await c.close(); }
  });
});

describe('Transacciones HTTP y rechazos', () => {
  let session: any, auditoria: any, conexion: any, req: any, ctx: any, interceptor: AuditoriaInterceptor;
  beforeEach(() => {
    session = { startTransaction: jest.fn(), commitTransaction: jest.fn(), abortTransaction: jest.fn(), endSession: jest.fn(), inTransaction: () => true };
    conexion = { startSession: jest.fn().mockResolvedValue(session) };
    auditoria = { registrar: jest.fn().mockResolvedValue({}) };
    req = { method: 'PATCH', path: '/alertas/gestion/id', user: { userId: 'usuario', nombre: 'Nombre real', role: 'Investigador' }, auditoria: contexto() };
    ctx = { switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({ statusCode: 200 }) }) };
    interceptor = new AuditoriaInterceptor(conexion, auditoria);
  });
  it('confirma solo después del registro y no confía en un actor enviado en el cuerpo', async () => {
    req.body = { usuario: 'falso' };
    const orden: string[] = [];
    auditoria.registrar.mockImplementation(async () => { orden.push('auditoria'); });
    session.commitTransaction.mockImplementation(async () => { orden.push('commit'); });
    await lastValueFrom(interceptor.intercept(ctx, { handle: () => defer(() => { expect(contextoAuditoria.getStore().session).toBe(session); return of('ok'); }) }));
    expect(orden).toEqual(['auditoria', 'commit']);
    expect(req.auditoria.usuario.nombre).toBe('Nombre real');
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });
  it('aborta si falla el registro de auditoría y no devuelve un éxito', async () => {
    auditoria.registrar.mockRejectedValue(new Error('sin bitácora'));
    await expect(lastValueFrom(interceptor.intercept(ctx, { handle: () => of('ok') }))).rejects.toThrow('sin bitácora');
    expect(session.abortTransaction).toHaveBeenCalled(); expect(session.commitTransaction).not.toHaveBeenCalled();
  });
  it('no reintenta el handler ni confirma si falla la operación del caso', async () => {
    const handle = jest.fn(() => throwError(() => new Error('conflicto')));
    await expect(lastValueFrom(interceptor.intercept(ctx, { handle }))).rejects.toThrow('conflicto');
    expect(handle).toHaveBeenCalledTimes(1); expect(session.abortTransaction).toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });
  it('bloquea DELETE de expedientes antes de ejecutar su handler', async () => {
    req.method = 'DELETE'; const handle = jest.fn();
    await expect(lastValueFrom(interceptor.intercept(ctx, { handle }))).rejects.toThrow('no se pueden eliminar');
    expect(handle).not.toHaveBeenCalled();
  });
  it('registra rechazos de permisos y genera la correlación en el servidor', async () => {
    let terminar: () => void;
    const res = { statusCode: 403, setHeader: jest.fn(), once: (_event: string, fn: () => void) => { terminar = fn; } };
    const middleware = new AuditoriaMiddleware(auditoria);
    req.headers = { 'user-agent': 'Prueba', 'x-solicitud-id': 'falso' }; req.ip = '127.0.0.1';
    middleware.use(req, res, () => {}); terminar(); await Promise.resolve();
    expect(req.auditoria.solicitudId).not.toBe('falso');
    expect(auditoria.registrar.mock.calls[0][1]).toMatchObject({ resultado: 'DENEGADO', codigoHttp: 403 });
  });
});

describe('Protección al iniciar el servidor', () => {
  const conexion = (acciones: string[] = ['find', 'insert', 'listIndexes']) => ({
    name: 'sgic', db: { command: jest.fn(async (cmd: any) => cmd.hello ? { setName: 'rs0' } : { authInfo: { authenticatedUsers: [{ user: 'sgic_app' }], authenticatedUserPrivileges: [{ resource: { db: 'sgic', collection: AUDIT_COLLECTION }, actions: acciones }] } }) },
    collection: () => ({ indexes: async () => [{ key: { eventoId: 1 }, unique: true }] }),
  });
  beforeEach(() => { process.env.AUDIT_HMAC_KEY = clave; });
  it('acepta exclusivamente lectura/inserción de auditoría con Mongo autenticado', async () => {
    await expect(new AuditoriaService(conexion() as any).onModuleInit()).resolves.toBeUndefined();
  });
  it.each(['remove', 'update', 'dropCollection', 'dropDatabase', 'createIndex', 'collMod', 'grantRole'])('rechaza privilegio peligroso %s sobre bitácora', async accion => {
    await expect(new AuditoriaService(conexion([accion]) as any).onModuleInit()).rejects.toThrow('modificar o borrar');
  });
  it('no permite omitir la firma ni usar Mongo standalone', async () => {
    process.env.AUDIT_HMAC_KEY = ''; await expect(new AuditoriaService(conexion() as any).onModuleInit()).rejects.toThrow('AUDIT_HMAC_KEY');
    process.env.AUDIT_HMAC_KEY = clave; const c = conexion(); c.db.command.mockResolvedValue({} as any);
    await expect(new AuditoriaService(c as any).onModuleInit()).rejects.toThrow('replica set');
  });
  it('rechaza índices de expiración que podrían borrar eventos sin permiso remove', async () => {
    const c = conexion(); c.collection = () => ({ indexes: async () => [{ key: { eventoId: 1 }, unique: true, expireAfterSeconds: 60 }] });
    await expect(new AuditoriaService(c as any).onModuleInit()).rejects.toThrow('TTL');
  });
});
