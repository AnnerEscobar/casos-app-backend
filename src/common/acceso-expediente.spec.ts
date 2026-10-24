import { Types } from 'mongoose';
import { UserRole } from '../auth/enums/user-role.enum';
import { accesoPersonal, exigirConsultaExpediente, exigirSeguimientoExpediente, filtrarAccesoExpedientes } from './acceso-expediente';
import { auditoriaSeguimiento } from './historicos/caso-historico.service';

describe('Acceso central a expedientes (QA-002 y QA-003)', () => {
  const a = new Types.ObjectId(), b = new Types.ObjectId(), casoId = new Types.ObjectId();
  const actor = (role = UserRole.INVESTIGADOR) => ({ userId: String(a), role });
  const caso = () => ({ _id: casoId, investigadorAsignado: b, registradoPor: b, estadoRegistro: 'Aprobado', seguimientos: [] });
  let find: jest.Mock, modelo: any;
  beforeEach(() => {
    find = jest.fn(() => ({ lean: () => ({ exec: async () => [] }) }));
    modelo = { db: { model: jest.fn(() => ({ find })) } };
  });
  it('normaliza asignaciones pobladas y la asignación principal prevalece sobre el autor', () => {
    expect(accesoPersonal({ ...caso(), investigadorAsignado: { _id: a } }, actor())).toBe(true);
    expect(accesoPersonal({ ...caso(), registradoPor: a }, actor())).toBe(false);
  });
  it('conserva el responsable histórico y el registrador de casos sin asignación explícita', () => {
    expect(accesoPersonal({ origenCaso: 'HISTORICO', investigadorOriginal: { usuarioId: a }, registradoPor: b }, actor())).toBe(true);
    expect(accesoPersonal({ registradoPor: a }, actor())).toBe(true);
  });
  it('deniega el detalle y excluye de la lista al investigador ajeno', async () => {
    await expect(exigirConsultaExpediente(modelo, caso(), 'alerta', actor())).rejects.toMatchObject({ status: 403 });
    await expect(filtrarAccesoExpedientes(modelo, [caso()], 'alerta', actor())).resolves.toEqual([]);
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'alerta', solicitante: String(a), estado: 'AUTORIZADA' }));
  });
  it('un permiso vigente concede lectura pero no seguimiento ni autoasignación', async () => {
    find.mockReturnValue({ lean: () => ({ exec: async () => [{ casoId: String(casoId) }] }) });
    await expect(exigirConsultaExpediente(modelo, caso(), 'maltrato', actor())).resolves.toBeUndefined();
    expect(() => exigirSeguimientoExpediente(caso(), actor())).toThrow('expediente ajeno');
  });
  it('un seguimiento previamente asignado concede acceso independiente de solicitudes revocadas', async () => {
    const asignado = { ...caso(), seguimientos: [{ investigadorAsignado: a }] };
    await expect(exigirConsultaExpediente(modelo, asignado, 'conflicto', actor())).resolves.toBeUndefined();
    expect(() => exigirSeguimientoExpediente(asignado, actor())).not.toThrow();
    expect(find).not.toHaveBeenCalled();
  });
  it.each([UserRole.ADMIN, UserRole.JEFE, UserRole.ANALISTA])('%s conserva lectura institucional', async role => {
    await expect(exigirConsultaExpediente(modelo, caso(), 'alerta', actor(role))).resolves.toBeUndefined();
    expect(find).not.toHaveBeenCalled();
  });
  it('solo el analista conserva escritura institucional y el investigador asignado escribe su caso', () => {
    expect(() => exigirSeguimientoExpediente(caso(), actor(UserRole.ANALISTA))).not.toThrow();
    for (const role of [UserRole.ADMIN, UserRole.JEFE])
      expect(() => exigirSeguimientoExpediente(caso(), actor(role))).toThrow();
    expect(() => exigirSeguimientoExpediente({ ...caso(), investigadorAsignado: a }, actor())).not.toThrow();
  });
  it('bloquea seguimiento previo a aprobación, sin confundirlo con la consulta', () => {
    for (const estadoRegistro of ['Pendiente', 'Rechazado'])
      expect(() => exigirSeguimientoExpediente({ ...caso(), investigadorAsignado: a, estadoRegistro }, actor())).toThrow('aprobado');
    expect(() => exigirSeguimientoExpediente({ ...caso(), investigadorAsignado: a, expedienteEnPreparacion: true }, actor())).toThrow('aprobado');
  });
  it('un investigador no asigna a otra persona mediante el cuerpo de un seguimiento', async () => {
    await expect(auditoriaSeguimiento(modelo, actor(), String(b))).rejects.toMatchObject({ status: 403 });
    expect(modelo.db.model).not.toHaveBeenCalled();
  });
  it('falla de forma cerrada si no recibe identidad válida', async () => {
    await expect(filtrarAccesoExpedientes(modelo, [caso()], 'alerta', undefined)).rejects.toMatchObject({ status: 403 });
    await expect(exigirConsultaExpediente(modelo, caso(), 'alerta', { userId: String(a), role: 'Inventado' } as any)).rejects.toMatchObject({ status: 403 });
  });
});
