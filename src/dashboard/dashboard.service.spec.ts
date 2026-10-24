import { Types } from 'mongoose';
import sift from 'sift';
import { DashboardService } from './dashboard.service';

describe('Dashboard por responsable del expediente', () => {
  const investigador = new Types.ObjectId();
  const analista = new Types.ObjectId();
  const otro = new Types.ObjectId();
  const procesos = ['procesoAlerta', 'procesoMaltrato', 'procesoConflicto'];

  // Ejecuta los filtros contra documentos representativos con el evaluador
  // Mongo de sift, sin conectarse ni modificar ninguna base de datos.
  function modelo(documentos: any[]) {
    return {
      find: jest.fn((filtro) => {
        const query = {
          populate: jest.fn(() => query),
          lean: jest.fn(() => query),
          exec: jest.fn(async () => documentos.filter(sift(filtro))),
        };
        return query;
      }),
      countDocuments: jest.fn(async (filtro) => documentos.filter(sift(filtro)).length),
    };
  }

  function preparar() {
    const modelos = procesos.map((proceso) => {
      const documentos = ['Aprobado', 'Pendiente', 'Rechazado'].flatMap((estadoRegistro) => [
        { etiqueta: 'asignado', estadoRegistro, [proceso]: true, registradoPor: analista, investigadorAsignado: investigador },
        { etiqueta: 'ajeno', estadoRegistro, [proceso]: true, registradoPor: investigador, investigadorAsignado: otro },
        { etiqueta: 'anterior-propio', estadoRegistro, registradoPor: investigador },
        { etiqueta: 'anterior-ajeno', estadoRegistro, registradoPor: otro },
        { etiqueta: 'sin-asignar', estadoRegistro, [proceso]: true, registradoPor: investigador },
      ]);
      documentos.push({ etiqueta: 'historico', registradoPor: otro } as any);
      return modelo(documentos);
    });
    return new DashboardService(modelos[0] as any, modelos[1] as any, modelos[2] as any);
  }

  it('incluye asignados por analista y registros anteriores propios en los tres tipos', async () => {
    const resultado = await preparar().obtenerDashboard({ userId: String(investigador), role: 'Investigador' });
    expect(resultado.alcance).toBe('PERSONAL');
    for (const casos of [resultado.alertas, resultado.maltratos, resultado.conflictos]) {
      expect(casos.map((c: any) => c.etiqueta)).toEqual(['asignado', 'anterior-propio']);
    }
    expect(resultado.resumen).toEqual({ totalCasos: 6, alertas: 2, maltratos: 2, conflictos: 2 });
    expect(resultado.autorizaciones.pendientes).toEqual({ total: 6, alertas: 2, maltratos: 2, conflictos: 2 });
    expect(resultado.autorizaciones.rechazados).toEqual({ total: 6, alertas: 2, maltratos: 2, conflictos: 2 });
  });

  it('otro investigador recibe solo sus casos y nunca los asignados al primero', async () => {
    const resultado = await preparar().obtenerDashboard({ userId: String(otro), role: 'Investigador' });
    for (const casos of [resultado.alertas, resultado.maltratos, resultado.conflictos]) {
      expect(casos.map((c: any) => c.etiqueta)).toEqual(['ajeno', 'anterior-ajeno']);
    }
  });

  it.each(['Analista', 'Jefe', 'Administrador'])('mantiene el alcance global de %s e históricos', async (role) => {
    const resultado = await preparar().obtenerDashboard({ userId: String(analista), role });
    expect(resultado.alcance).toBe('GLOBAL');
    expect(resultado.resumen.totalCasos).toBe(18);
    expect(resultado.autorizaciones.pendientes.total).toBe(15);
    expect(resultado.autorizaciones.rechazados.total).toBe(15);
  });
});
