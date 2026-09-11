import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { model, Types, Schema } from 'mongoose';
import { CasosAlertaSchema } from '../casos-alerta/entities/casos-alerta.entity';
import { CasosMaltratoSchema } from '../casos-maltrato/entities/casos-maltrato.entity';
import { CasosConflictoSchema } from '../casos-conflicto/entities/casos-conflicto.entity';
import { CasosAlertaService } from '../casos-alerta/casos-alerta.service';
import { CasosMaltratoService } from '../casos-maltrato/casos-maltrato.service';
import { CasosConflictoService } from '../casos-conflicto/casos-conflicto.service';
import { UserRole } from '../auth/enums/user-role.enum';
import { guardarSeguimiento, validarSeguimientoAbierto, esEstadoTerminal, poblarUsuariosSeguimientos } from './seguimiento-terminal';

const usuario = { userId: new Types.ObjectId().toString(), role: UserRole.INVESTIGADOR };
const casos = [
  { tipo: 'alerta', schema: CasosAlertaSchema, service: CasosAlertaService, terminal: 'Concluido', campo: 'nuevoEstado' },
  { tipo: 'maltrato', schema: CasosMaltratoSchema, service: CasosMaltratoService, terminal: 'Desestimado', campo: 'estado' },
  { tipo: 'conflicto', schema: CasosConflictoSchema, service: CasosConflictoService, terminal: 'Desestimado', campo: 'estado' },
] as const;

describe.each(casos)('Cierre de $tipo', ({ tipo, schema, service, terminal, campo }) => {
  const Modelo = model<any>(`PruebaTerminal_${tipo}`, schema);
  let doc: any;
  let drive: { uploadFile: jest.Mock };
  let svc: any;
  const crear = (estado: string) => tipo === 'alerta'
    ? svc.actualizarCasoConSeguimiento('DEIC52-2016-05-18-421', { nuevoEstado: estado }, [], usuario)
    : svc.agregarSeguimiento('DEIC51-2016-05-18-421', estado, { originalname: 'actuacion.pdf' }, usuario);
  beforeEach(() => {
    jest.spyOn(Modelo.db, 'model').mockReturnValue({ exists: jest.fn().mockResolvedValue({ _id: usuario.userId }) } as any);
    doc = new Modelo({ seguimientos: [] });
    jest.spyOn(Modelo, 'findOne').mockResolvedValue(doc);
    jest.spyOn(doc, 'save').mockResolvedValue(doc);
    jest.spyOn(doc, 'populate').mockResolvedValue(doc);
    drive = { uploadFile: jest.fn().mockResolvedValue('https://example.test/documento.pdf') };
    svc = new service(Modelo as any, drive as any);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(['SISTEMA', 'HISTORICO'])('%s permite primero, Informado repetido y cierre; rechaza el siguiente con 409', async origenCaso => {
    doc.origenCaso = origenCaso;
    for (const estado of ['Informado', 'Informado', terminal]) await crear(estado);
    expect(doc.seguimientos.map(s => s[campo])).toEqual(['Informado', 'Informado', terminal]);
    doc.save.mockClear(); drive.uploadFile.mockClear();
    await expect(crear('Informado')).rejects.toMatchObject({ status: 409 });
    expect(doc.save).not.toHaveBeenCalled();
    expect(drive.uploadFile).not.toHaveBeenCalled();
  });

  it('usa el último registro persistido y no un cierre anterior ni el máximo de fecha', async () => {
    doc.seguimientos = [{ [campo]: terminal, fecha: new Date('2026-09-10') }, { [campo]: 'Informado', fecha: new Date('2026-09-01') }];
    await expect(crear('Informado')).resolves.toBeDefined();
    expect(doc.seguimientos).toHaveLength(3);
  });

  it('mantiene el cierre al cargar de nuevo un documento', async () => {
    const persistido = new Modelo({ seguimientos: [{ [campo]: terminal }] }).toObject();
    doc = Modelo.hydrate(persistido);
    jest.spyOn(Modelo, 'findOne').mockResolvedValue(doc);
    await expect(crear('Informado')).rejects.toBeInstanceOf(ConflictException);
  });

  it('puebla únicamente los nombres del seguimiento en la consulta', async () => {
    await svc.buscarPorNumeroDeic('DEIC51-2016-05-18-421');
    expect(doc.populate).toHaveBeenCalledWith([
      { path: 'seguimientos.investigadorAsignado', model: 'Usuario', select: 'nombre', strictPopulate: false },
      { path: 'seguimientos.registradoPor', model: 'Usuario', select: 'nombre', strictPopulate: false },
    ]);
  });

  if (tipo === 'alerta') it('Informado a Remitido cierra; bloquea Informado, Remitido y Concluido posteriores', async () => {
    for (const estado of ['Informado', 'Remitido']) await crear(estado);
    expect(doc.seguimientos).toHaveLength(2);
    for (const estado of ['Informado', 'Remitido', 'Concluido']) await expect(crear(estado)).rejects.toMatchObject({ status: 409 });
  });
});

describe('Decisión terminal y concurrencia', () => {
  afterEach(() => jest.restoreAllMocks());
  it('no mezcla los estados de módulos distintos', () => {
    expect(esEstadoTerminal('alerta', 'Desestimado')).toBe(false);
    expect(esEstadoTerminal('maltrato', 'Concluido')).toBe(false);
    expect(esEstadoTerminal('conflicto', 'Concluido')).toBe(false);
    for (const tipo of ['alerta', 'maltrato', 'conflicto'] as const) {
      for (const seguimientos of [undefined, null, []]) expect(() => validarSeguimientoAbierto(tipo, { seguimientos })).not.toThrow();
    }
  });
  it('incluye la condición de historial en la escritura Mongo y transforma conflicto concurrente en 409', async () => {
    const Modelo = model('PruebaEscrituraTerminal', new Schema({ seguimientos: [Object] }));
    const doc = Modelo.hydrate({ _id: new Types.ObjectId(), seguimientos: [], __v: 0 });
    doc.seguimientos.push({ estado: 'Informado' });
    const write = jest.spyOn(Modelo.collection, 'updateOne').mockResolvedValue({ acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0, upsertedId: null });
    await expect(guardarSeguimiento(doc, 0)).rejects.toMatchObject({ status: 409 });
    expect(write.mock.calls[0][0]).toMatchObject({ $expr: { $eq: [{ $size: { $ifNull: ['$seguimientos', []] } }, 0] } });
  });
});

describe('Nombres en los tres schemas reales, incluido Array de Alerta', () => {
  const Usuarios = model('Usuario', new Schema({ nombre: String }));
  afterEach(() => jest.restoreAllMocks());
  it.each(casos)('$tipo resuelve ambas referencias sin confundirlas', async ({ tipo, schema, campo }) => {
    const responsable = new Usuarios({ nombre: 'Pedro' });
    const registrador = new Usuarios({ nombre: 'María' });
    const buscar = jest.spyOn(Usuarios, 'find').mockReturnValue({ exec: async () => [responsable, registrador] } as any);
    const Modelo = model(`PruebaPoblacion_${tipo}`, schema);
    const doc = new Modelo({ seguimientos: [{ [campo]: 'Informado', investigadorAsignado: responsable._id, registradoPor: registrador._id }] });
    await poblarUsuariosSeguimientos(doc);
    expect((doc.toObject().seguimientos[0] as any).investigadorAsignado.nombre).toBe('Pedro');
    expect((doc.toObject().seguimientos[0] as any).registradoPor.nombre).toBe('María');
    expect((buscar.mock.calls as unknown[][]).every(call => call[1] === 'nombre')).toBe(true);
  });
});
