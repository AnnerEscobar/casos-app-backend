import { Types } from 'mongoose';
import { CasosAlertaService } from '../casos-alerta/casos-alerta.service';
import { CasosMaltratoService } from '../casos-maltrato/casos-maltrato.service';
import { CasosConflictoService } from '../casos-conflicto/casos-conflicto.service';
import { EstadoRegistro } from './enums/estado-registro.enum';

const variantes = [
  { nombre: 'Alerta', proceso: 'procesoAlerta', crear: (modelo: any) => new CasosAlertaService(modelo, null) },
  { nombre: 'Maltrato', proceso: 'procesoMaltrato', crear: (modelo: any) => new CasosMaltratoService(modelo, null) },
  { nombre: 'Conflicto', proceso: 'procesoConflicto', crear: (modelo: any) => new CasosConflictoService(modelo, null) },
];

describe.each(variantes)('Mis registros y aprobados recientes: $nombre', ({ proceso, crear }) => {
  const investigador = new Types.ObjectId();
  let modelo: any;
  let pendientes: any;
  let aprobados: any;
  let service: ReturnType<typeof crear>;

  function consulta(filas: any[]) {
    let maximo: number | undefined;
    return {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn(function (cantidad: number) { maximo = cantidad; return this; }),
      exec: jest.fn(async () => maximo === undefined ? filas : filas.slice(0, maximo)),
    };
  }

  beforeEach(() => {
    pendientes = consulta(Array.from({ length: 12 }, (_, i) => ({
      _id: `pendiente-${i}`, estadoRegistro: i % 2 ? EstadoRegistro.RECHAZADO : EstadoRegistro.PENDIENTE,
    })));
    aprobados = consulta(Array.from({ length: 11 }, (_, i) => ({
      _id: `aprobado-${i}`, estadoRegistro: EstadoRegistro.APROBADO,
      fechaRevision: new Date(Date.UTC(2026, 9, 24 - i)),
    })));
    modelo = { find: jest.fn().mockReturnValueOnce(pendientes).mockReturnValueOnce(aprobados) };
    service = crear(modelo);
  });

  it('restringe ambos grupos al asignado actual o al registrador del proceso anterior', async () => {
    await service.findMisRegistros(String(investigador));
    const propiedad = [
      { [proceso]: true, investigadorAsignado: investigador },
      { [proceso]: { $ne: true }, registradoPor: investigador },
    ];
    expect(modelo.find).toHaveBeenNthCalledWith(1, {
      $or: propiedad,
      estadoRegistro: { $in: [EstadoRegistro.PENDIENTE, EstadoRegistro.RECHAZADO] },
    });
    expect(modelo.find).toHaveBeenNthCalledWith(2, {
      $or: propiedad, estadoRegistro: EstadoRegistro.APROBADO,
    });
  });

  it('conserva todos los pendientes y rechazados aunque superen diez', async () => {
    const filas = await service.findMisRegistros(String(investigador));
    expect(filas).toHaveLength(22);
    expect(filas.slice(0, 12)).toEqual(await pendientes.exec());
    expect(pendientes.limit).not.toHaveBeenCalled();
    expect(pendientes.sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it('limita únicamente aprobados a diez con orden compatible entre los tres tipos', async () => {
    const filas = await service.findMisRegistros(String(investigador));
    expect(aprobados.sort).toHaveBeenCalledWith({ fechaRevision: -1, createdAt: -1, _id: -1 });
    expect(aprobados.limit).toHaveBeenCalledTimes(1);
    expect(aprobados.limit).toHaveBeenCalledWith(10);
    expect(filas.filter(fila => fila.estadoRegistro === EstadoRegistro.APROBADO)).toHaveLength(10);
    expect(filas.some(fila => String(fila._id) === 'aprobado-10')).toBe(false);
  });

  it('conserva el formato poblado y devuelve la lista anterior cuando no hay aprobados', async () => {
    aprobados.exec.mockResolvedValue([]);
    await expect(service.findMisRegistros(String(investigador))).resolves.toEqual(await pendientes.exec());
    for (const query of [pendientes, aprobados]) {
      expect(query.populate).toHaveBeenCalledWith('revisadoPor', 'nombre email role');
      expect(query.populate).toHaveBeenCalledWith('historialRevisiones.usuario', 'nombre email role');
    }
  });
});
