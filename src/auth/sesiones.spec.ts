import { SesionesService, INACTIVIDAD_MS } from './sesiones.service';
import { contextoAuditoria, datosAuditables, verificarFirma } from '../auditoria/auditoria-core';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';

describe('Sesiones por inactividad y duración auditada', () => {
  let model: any, sesion: any, servicio: SesionesService;
  const ahora = new Date('2026-10-23T01:00:00Z');
  const user = () => ({ _id: 'usuario', nombre: 'Nombre', role: 'Investigador', token: 'secreto', sesionId: 'sesion',
    sesionInicio: new Date(ahora.getTime() - 2 * 3600000), sesionUltimaActividad: new Date(ahora.getTime() - INACTIVIDAD_MS), sesionExpira: ahora });
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(ahora);
    process.env.AUDIT_HMAC_KEY = 'clave-de-prueba-de-al-menos-treinta-y-dos-bytes';
    sesion = { startTransaction: jest.fn(), commitTransaction: jest.fn(), abortTransaction: jest.fn(), endSession: jest.fn(), inTransaction: () => true };
    model = { db: { startSession: jest.fn().mockResolvedValue(sesion), collection: () => ({ insertOne: model.insertOne }) },
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(user()) }), insertOne: jest.fn().mockResolvedValue({}) };
    servicio = new SesionesService(model);
  });
  afterEach(() => { servicio.onModuleDestroy(); jest.useRealTimers(); });
  it('firma un cierre por inactividad con inicio, vencimiento y duración total reales', async () => {
    jest.setSystemTime(new Date(ahora.getTime() + 45000));
    await servicio.cerrar(user(), 'INACTIVIDAD');
    const evento = model.insertOne.mock.calls[0][0];
    expect(evento).toMatchObject({ accion: 'CERRAR_SESION', recurso: 'Usuario', sesion: { id: 'sesion', fin: ahora, duracionSegundos: 7200, motivo: 'INACTIVIDAD' } });
    expect(verificarFirma(evento, process.env.AUDIT_HMAC_KEY)).toBe(true);
    expect(JSON.stringify(evento)).not.toContain('secreto');
    expect(sesion.commitTransaction).toHaveBeenCalledTimes(1);
    expect(model.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ sesionId: 'sesion', token: 'secreto', sesionExpira: { $lte: expect.any(Date) } });
  });
  it('el cierre manual reutiliza la transacción HTTP y no confirma antes del interceptor', async () => {
    await contextoAuditoria.run({ solicitudId: 'req', metodo: 'POST', ruta: '/auth/logout', ip: 'ip', agente: 'agente', eventos: 0, session: sesion },
      () => servicio.cerrar(user(), 'MANUAL'));
    expect(model.db.startSession).not.toHaveBeenCalled();
    expect(sesion.commitTransaction).not.toHaveBeenCalled();
    expect(model.insertOne.mock.calls[0][0].sesion.motivo).toBe('MANUAL');
  });
  it('revierte la invalidación si falla la bitácora', async () => {
    model.insertOne.mockRejectedValue(new Error('sin bitácora'));
    await expect(servicio.cerrar(user(), 'INACTIVIDAD')).rejects.toThrow('sin bitácora');
    expect(sesion.abortTransaction).toHaveBeenCalled();
    expect(sesion.commitTransaction).not.toHaveBeenCalled();
  });
  it('no duplica un cierre ni cierra una sesión reemplazada o renovada', async () => {
    model.findOneAndUpdate.mockReturnValue({ exec: async () => null });
    await servicio.cerrar(user(), 'INACTIVIDAD');
    expect(model.insertOne).not.toHaveBeenCalled();
  });
  it('la actividad exige una sesión vigente y renueva el plazo sin producir eventos', async () => {
    const respuesta = await servicio.actividad('usuario', 'sesion');
    expect(respuesta.expiresAt).toBe(ahora.getTime() + INACTIVIDAD_MS);
    expect(model.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ sesionId: 'sesion', sesionExpira: { $gt: ahora } });
    expect(model.insertOne).not.toHaveBeenCalled();
    model.findOneAndUpdate.mockReturnValue({ exec: async () => null });
    await expect(servicio.actividad('usuario', 'sesion')).rejects.toThrow('ya no está activa');
  });
  it('una sesión activa puede durar más de una hora; una vencida no pasa el guard', async () => {
    await expect(servicio.validar({ ...user(), sesionExpira: new Date(ahora.getTime() + 1000) })).resolves.toBeUndefined();
    await expect(servicio.validar(user())).rejects.toThrow('inactividad');
    expect(model.insertOne).toHaveBeenCalledTimes(1);
  });
  it('el barrido detecta sesiones con el navegador cerrado', async () => {
    model.find = jest.fn().mockReturnValue({ limit: () => ({ exec: async () => [user()] }) });
    await servicio.cerrarVencidas();
    expect(model.insertOne.mock.calls[0][0].sesion.motivo).toBe('INACTIVIDAD');
  });
  it('el token nuevo identifica la sesión y no contiene un vencimiento fijo de una hora', async () => {
    model.findByIdAndUpdate = jest.fn().mockResolvedValue({});
    const jwt = new JwtService({ secret: 'prueba' });
    const auth = new AuthService(model, jwt, servicio);
    const respuesta = await auth.login({ ...user(), sesionId: undefined });
    const payload = jwt.verify(respuesta.access_token);
    expect(payload.jti).toBeTruthy();
    expect(payload.exp).toBeUndefined();
    expect(respuesta.expiresAt).toBe(ahora.getTime() + INACTIVIDAD_MS);
  });
  it('las renovaciones técnicas no se convierten en cambios de negocio', () => {
    expect(datosAuditables(user())).toEqual({ _id: 'usuario', nombre: 'Nombre', role: 'Investigador' });
  });
});
