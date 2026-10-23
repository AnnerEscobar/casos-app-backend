import { ConflictException } from '@nestjs/common';
import { createConnection, Types } from 'mongoose';
import { BusquedaAccesoService } from './busqueda-acceso.service';
import { SolicitudAccesoSchema } from './solicitud-acceso.schema';
import { auditoriaPlugin } from '../auditoria/auditoria-plugin';
import { AUDIT_COLLECTION, contextoAuditoria, verificarFirma } from '../auditoria/auditoria-core';
import { UserRole } from '../auth/enums/user-role.enum';

// Usa servicio, esquema y hooks reales; simula el driver sin escribir en una base de datos.
describe('Solicitar acceso con auditoría instalada (QA-001)', () => {
  const clave = 'clave-ficticia-de-pruebas-auditoria-123456';
  const casoId = new Types.ObjectId(), solicitante = new Types.ObjectId();
  const responsable = new Types.ObjectId();
  const dto = { tipo: 'alerta', casoId: String(casoId), motivo: 'CONSULTAR ANTECEDENTES' };
  const usuario = { userId: String(solicitante), role: UserRole.INVESTIGADOR };
  let conexion: any, modelo: any, servicio: any, dato: any, eventos: any[], session: any;
  let claveAnterior: string | undefined;
  beforeEach(() => {
    claveAnterior = process.env.AUDIT_HMAC_KEY;
    process.env.AUDIT_HMAC_KEY = clave;
    conexion = createConnection();
    conexion.plugin(auditoriaPlugin);
    const schema = SolicitudAccesoSchema.clone(); schema.set('bufferCommands', false);
    modelo = conexion.model('SolicitudAcceso', schema);
    // Una sesión del driver es una instancia; Mongoose clona los objetos planos de opciones.
    dato = null; eventos = []; session = new class {
      hasEnded = false;
      inTransaction() { return true; }
    }();
    jest.spyOn(modelo.collection, 'insertOne').mockImplementation(async (doc: any, opciones: any) => {
      expect(opciones.session).toBe(session);
      dato = { ...doc }; return { acknowledged: true, insertedId: doc._id } as any;
    });
    jest.spyOn(modelo.collection, 'findOne').mockImplementation(async () => dato && { ...dato });
    jest.spyOn(modelo.collection, 'findOneAndUpdate').mockImplementation(async (_f: any, update: any, opciones: any) => {
      expect(opciones.session).toBe(session);
      expect(opciones.upsert).not.toBe(true);
      if (!dato) return null;
      dato = { ...dato, ...update.$set };
      for (const campo of Object.keys(update.$unset || {})) delete dato[campo];
      return { ...dato };
    });
    jest.spyOn(conexion.collection(AUDIT_COLLECTION), 'insertOne').mockImplementation(async (evento: any, opciones: any) => {
      expect(opciones.session).toBe(session);
      eventos.push(evento); return { acknowledged: true } as any;
    });
    servicio = new BusquedaAccesoService(modelo);
    jest.spyOn(servicio, 'cargar' as any).mockResolvedValue({ _id: casoId });
    jest.spyOn(servicio, 'presentar').mockImplementation(async () => [{
      acceso: 'RESTRINGIDO', numeroDeic: 'DEIC-QA-001', investigador: { _id: responsable },
      solicitud: dato ? { _id: dato._id, estado: dato.estado } : null,
    }]);
  });
  afterEach(async () => {
    jest.restoreAllMocks(); await conexion.close();
    if (claveAnterior === undefined) delete process.env.AUDIT_HMAC_KEY;
    else process.env.AUDIT_HMAC_KEY = claveAnterior;
  });
  const ejecutar = (fn: () => any) => contextoAuditoria.run({
    solicitudId: 'qa-001', usuario: { id: String(solicitante), rol: UserRole.INVESTIGADOR },
    metodo: 'POST', ruta: '/busquedas/solicitudes', ip: '127.0.0.1', agente: 'QA', eventos: 0, session,
  } as any, fn);

  it('crea la solicitud y un evento firmado en la misma sesión', async () => {
    const resultado = await ejecutar(() => servicio.solicitar(dto, usuario));
    expect(resultado.estado).toBe('PENDIENTE');
    expect(String(resultado.solicitante)).toBe(String(solicitante));
    expect(modelo.collection.findOneAndUpdate).not.toHaveBeenCalled();
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ accion: 'CREAR', recurso: 'SolicitudAcceso' });
    expect(verificarFirma(eventos[0], clave)).toBe(true);
  });
  it.each(['RECHAZADA', 'REVOCADA'])('reactiva %s sin duplicar y audita el cambio', async estado => {
    dato = { _id: new Types.ObjectId(), ...dto, casoId, solicitante, estado,
      resueltoPor: responsable, fechaResolucion: new Date(), revocadoPor: responsable, fechaRevocacion: new Date() };
    const idAnterior = String(dato._id);
    const resultado = await ejecutar(() => servicio.solicitar(dto, usuario));
    expect(String(resultado._id)).toBe(idAnterior);
    expect(resultado.estado).toBe('PENDIENTE');
    expect(resultado.fechaRevocacion).toBeUndefined();
    expect(resultado.resueltoPor).toBeUndefined();
    expect(modelo.collection.insertOne).not.toHaveBeenCalled();
    expect(eventos).toHaveLength(1);
    expect(eventos[0].cambios).toContainEqual({ campo: 'estado', anterior: estado, nuevo: 'PENDIENTE' });
    expect(verificarFirma(eventos[0], clave)).toBe(true);
  });
  it('no permite confirmar la solicitud cuando falla el registro de auditoría', async () => {
    conexion.collection(AUDIT_COLLECTION).insertOne.mockRejectedValueOnce(new Error('Auditoría no disponible'));
    await expect(ejecutar(() => servicio.solicitar(dto, usuario))).rejects.toThrow('Auditoría no disponible');
  });
  it('rechaza una solicitud que cambió de estado antes de reactivarla', async () => {
    dato = { _id: new Types.ObjectId(), estado: 'REVOCADA' };
    modelo.collection.findOneAndUpdate.mockResolvedValueOnce(null);
    await expect(ejecutar(() => servicio.solicitar(dto, usuario))).rejects.toBeInstanceOf(ConflictException);
    expect(modelo.collection.insertOne).not.toHaveBeenCalled();
  });
});
