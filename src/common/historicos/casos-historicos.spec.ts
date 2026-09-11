import { Test } from '@nestjs/testing';
import request = require('supertest');
import 'reflect-metadata';
import { BadRequestException, ConflictException, ForbiddenException, ValidationPipe } from '@nestjs/common';
import { model, Types } from 'mongoose';
import { CreateHistoricoAlertaDto } from '../../casos-alerta/dto/create-historico-alerta.dto';
import { CreateHistoricoMaltratoDto } from '../../casos-maltrato/dto/create-historico-maltrato.dto';
import { CreateHistoricoConflictoDto } from '../../casos-conflicto/dto/create-historico-conflicto.dto';
import { CreateCasosAlertaDto } from '../../casos-alerta/dto/create-casos-alerta.dto';
import { CreateCasosMaltratoDto } from '../../casos-maltrato/dto/create-casos-maltrato.dto';
import { CreateCasosConflictoDto } from '../../casos-conflicto/dto/create-casos-conflicto.dto';
import { CasosAlertaSchema } from '../../casos-alerta/entities/casos-alerta.entity';
import { CasosMaltratoSchema } from '../../casos-maltrato/entities/casos-maltrato.entity';
import { CasosConflictoSchema } from '../../casos-conflicto/entities/casos-conflicto.entity';
import { CasosAlertaService } from '../../casos-alerta/casos-alerta.service';
import { CasosMaltratoService } from '../../casos-maltrato/casos-maltrato.service';
import { CasosConflictoService } from '../../casos-conflicto/casos-conflicto.service';
import { UserRole } from '../../auth/enums/user-role.enum';
import { EstadoRegistro } from '../enums/estado-registro.enum';
import { auditoriaSeguimiento, incorporarHistorico } from './caso-historico.service';
import { normalizeCaseNumber, normalizeMpNumber } from '../case-number.validator';
import { SeguimientoDto } from '../dto/seguimiento.dto';
import { UpdateCasosAlertaDto } from '../../casos-alerta/dto/update-casos-alerta.dto';
import { CasosAlertaController } from '../../casos-alerta/casos-alerta.controller';
import { CasosMaltratoController } from '../../casos-maltrato/casos-maltrato.controller';
import { CasosConflictoController } from '../../casos-conflicto/casos-conflicto.controller';
import { JwtAuthGuard } from '../../auth/Guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/Guards/roles.guard';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const validar = (metatype: any, body: any) => pipe.transform(body, { type: 'body', metatype });
const analista = { userId: new Types.ObjectId().toString(), role: UserRole.ANALISTA };
const investigador = { userId: new Types.ObjectId().toString(), role: UserRole.INVESTIGADOR };
const casos = [
  { tipo: 'alerta', dto: CreateHistoricoAlertaDto, normal: CreateCasosAlertaDto, schema: CasosAlertaSchema, service: CasosAlertaService, numero: 'DEIC52-2016-05-18-421' },
  { tipo: 'maltrato', dto: CreateHistoricoMaltratoDto, normal: CreateCasosMaltratoDto, schema: CasosMaltratoSchema, service: CasosMaltratoService, numero: 'DEIC51-2016-05-18-421' },
  { tipo: 'conflicto', dto: CreateHistoricoConflictoDto, normal: CreateCasosConflictoDto, schema: CasosConflictoSchema, service: CasosConflictoService, numero: 'DEIC53-2016-05-18-421' },
] as const;

describe.each(casos)('Históricos: $tipo', ({ tipo, dto, normal, schema, service, numero }) => {
  const Modelo = model<any>(`PruebaHistorico_${tipo}`, schema);
  const minimo = { numeroDeic: numero, origenCaso: 'HISTORICO', estadoExpedienteHistorico: 'NO_LOCALIZADO' };

  beforeEach(() => { jest.spyOn(Modelo.prototype, 'populate').mockImplementation(async function () { return this; }); });
  afterEach(() => jest.restoreAllMocks());

  it.each(['COMPLETO', 'PARCIAL', 'NO_LOCALIZADO'])('acepta datos desconocidos con expediente %s', async estado => {
    const payload = await validar(dto, { ...minimo, estadoExpedienteHistorico: estado });
    const doc = new Modelo(payload);
    await expect(doc.validate()).resolves.toBeUndefined();
    expect(doc.get('investigadorOriginal')).toBeUndefined();
    expect(doc.get('fechaIncorporacionSistema')).toBeUndefined();
    expect(doc.get('numeroMp')).toBeUndefined();
    expect(doc.get('nombreDesaparecido')).toBeUndefined();
  });

  it('mantiene las validaciones del registro normal y el origen por defecto', async () => {
    await expect(validar(normal, { numeroDeic: numero })).rejects.toBeInstanceOf(BadRequestException);
    const doc = new Modelo({ numeroDeic: numero });
    expect(doc.get('origenCaso')).toBe('SISTEMA');
    await expect(doc.validate()).rejects.toThrow();
    const anterior = Modelo.hydrate({ numeroDeic: numero });
    expect(anterior.get('origenCaso')).toBe('SISTEMA');
    expect(anterior.get('fechaIncorporacionSistema')).toBeUndefined();
    await expect(validar(normal, minimo)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acepta un registro normal completo y permite guardar una Alerta V2 sin denunciante', async () => {
    const persona = { nombre: 'Nombre de prueba', cui: '1234567890123', fecha_Nac: '2005-02-03', direccion: 'Dirección de prueba' };
    const lugar = { departamento: 'Guatemala', municipio: 'Guatemala', direccionDetallada: 'Dirección de prueba' };
    const payload = tipo === 'alerta' ? {
      numeroDeic: numero, numeroMp: 'M0030-2016-123', numeroAlerta: '421-2016', estadoInvestigacion: 'En investigación',
      nombreDesaparecido: persona.nombre, fecha_Nac: persona.fecha_Nac,
      denunciante: { nombre: 'Denunciante de prueba' }, lugarDesaparicion: lugar,
    } : {
      numeroDeic: numero, numeroMp: 'MP001-2016-123', estadoInvestigacion: 'En investigación',
      victimas: [persona], [tipo === 'maltrato' ? 'sindicados' : 'infractores']: [persona], lugarHechos: lugar,
    };
    const body = await validar(normal, payload);
    jest.spyOn(Modelo, 'findOne').mockResolvedValue(null);
    jest.spyOn(Modelo.prototype, 'save').mockImplementation(async function () { await this.validate(); return this; });
    const uploadFile = jest.fn().mockResolvedValue('https://drive.google.com/uc?id=normal');
    const svc: any = new service(Modelo as any, { uploadFile } as any);
    const file = { originalname: 'normal.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4') };
    const creado = await svc.create(body, file, analista);
    expect(uploadFile).toHaveBeenCalledWith({ ...file, originalname: numero + '.pdf' });
    expect(creado.fileUrls).toEqual([tipo === 'alerta' ? 'https://drive.google.com/uc?export=download&id=normal' : 'https://drive.google.com/uc?id=normal']);

    const doc = new Modelo({ ...body,
      ...(tipo === 'alerta' ? { direccion: body.lugarDesaparicion } : {}),
      ...(tipo === 'maltrato' ? { infractores: body.sindicados } : {}),
    });
    await expect(doc.validate()).resolves.toBeUndefined();
    if (tipo === 'alerta') {
      const previo = Modelo.hydrate({ ...doc.toObject(), origenCaso: undefined, denunciante: undefined });
      await expect(previo.validate()).resolves.toBeUndefined();
    }
  });

  it.each([
    { estadoExpedienteHistorico: 'PERDIDO' }, { estadoExpedienteHistorico: undefined },
    { origenCaso: 'SISTEMA' }, { fuenteInformacionHistorica: 'OTRA' },
    { registradoPor: analista.userId }, { fechaIncorporacionSistema: '2016-01-01' },
    { estadoRegistro: 'Aprobado' }, { investigadorOriginal: { usuarioId: 'incorrecto' } },
    { anioCaso: 2016.5 }, { investigadorOriginal: [] },
  ])('rechaza metadatos inválidos o auditoría enviada por cliente: %j', async datos => {
    await expect(validar(dto, { ...minimo, ...datos })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('permite personas y lugares parcialmente conocidos sin debilitar el schema normal', async () => {
    const datos = tipo === 'alerta'
      ? { nombreDesaparecido: 'Persona conocida', denunciante: { telefono: '12345678' }, lugarDesaparicion: { municipio: 'Guatemala' } }
      : { victimas: [{ nombre: 'Persona conocida' }], lugarHechos: { municipio: 'Guatemala' } };
    const payload = await validar(dto, { ...minimo, ...datos });
    const persistido = tipo === 'alerta' ? { ...payload, direccion: payload.lugarDesaparicion } : payload;
    const doc = new Modelo(persistido);
    await expect(doc.validate()).resolves.toBeUndefined();
    if (tipo !== 'alerta') {
      expect(doc.get('victimas')[0].cui).toBeUndefined();
      doc.set('origenCaso', 'SISTEMA');
      const errors = doc.validateSync().errors;
      expect(errors['victimas.0.cui']).toBeDefined();
    }
  });

  it('incorpora con auditoría JWT, mantiene mapeos y devuelve el caso completo', async () => {
    jest.spyOn(Modelo, 'exists').mockResolvedValue(null);
    jest.spyOn(Modelo.prototype, 'save').mockImplementation(async function () { await this.validate(); return this; });
    const svc: any = new service(Modelo as any, {} as any);
    const datos = tipo === 'maltrato' ? { sindicados: [{ nombre: 'Nombre conocido' }] }
      : tipo === 'alerta' ? { lugarDesaparicion: { municipio: 'Guatemala' } } : {};
    const payload = await validar(dto, { ...minimo, ...datos, numeroDeic: `\u200E ${numero.toLowerCase()} `, investigadorOriginal: { nombre: 'Juan Pérez' } });
    const doc = await svc.incorporarHistorico(payload, analista);
    expect(doc.numeroDeic).toBe(numero);
    expect(String(doc.registradoPor)).toBe(analista.userId);
    expect(doc.investigadorOriginal.nombre).toBe('Juan Pérez');
    expect(doc.investigadorOriginal.usuarioId).toBeUndefined();
    expect(doc.fechaIncorporacionSistema).toBeInstanceOf(Date);
    expect(doc.estadoRegistro).toBe(EstadoRegistro.APROBADO);
    expect(doc.fileUrls).toEqual([]);
    expect(doc._id).toBeDefined();
    if (tipo === 'maltrato') expect(doc.infractores[0].nombre).toBe('Nombre conocido');
    if (tipo === 'alerta') expect(doc.direccion.municipio).toBe('Guatemala');
    const pendiente = await svc.incorporarHistorico(payload, investigador);
    expect(pendiente.estadoRegistro).toBe(EstadoRegistro.PENDIENTE);
  });

  it.each(['COMPLETO', 'PARCIAL'])('guarda PDF %s en fileUrls usando el almacenamiento normal', async estado => {
    jest.spyOn(Modelo, 'exists').mockResolvedValue(null);
    jest.spyOn(Modelo.prototype, 'save').mockImplementation(async function () { await this.validate(); return this; });
    const uploadFile = jest.fn().mockResolvedValue('https://drive.google.com/uc?id=original');
    const svc: any = new service(Modelo as any, { uploadFile } as any);
    const file = { originalname: 'expediente.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4') } as Express.Multer.File;
    const payload = await validar(dto, { ...minimo, estadoExpedienteHistorico: estado });
    const doc = await svc.incorporarHistorico(payload, analista, file);
    expect(uploadFile).toHaveBeenCalledWith({ ...file, originalname: numero + '.pdf' });
    expect(doc.fileUrls).toEqual([tipo === 'alerta' ? 'https://drive.google.com/uc?export=download&id=original' : 'https://drive.google.com/uc?id=original']);
    expect(doc.seguimientos).toEqual([]);
    // La consulta/hidratación usa el mismo campo que los casos anteriores.
    expect(Modelo.hydrate(doc.toObject()).fileUrls).toEqual(doc.fileUrls);
  });

  it('mantiene separados el PDF incorporado y el PDF del seguimiento posterior', async () => {
    jest.spyOn(Modelo, 'exists').mockResolvedValue(null);
    jest.spyOn(Modelo.prototype, 'save').mockImplementation(async function () { await this.validate(); return this; });
    jest.spyOn(Modelo.db, 'model').mockReturnValue({ exists: jest.fn().mockResolvedValue({ _id: investigador.userId }) } as any);
    const drive = { uploadFile: jest.fn().mockResolvedValueOnce('https://drive.google.com/uc?id=original').mockResolvedValue('https://drive.google.com/uc?id=seguimiento') };
    const svc: any = new service(Modelo as any, drive as any);
    const file = { originalname: 'expediente.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.4') };
    const doc = await svc.incorporarHistorico(await validar(dto, { ...minimo, estadoExpedienteHistorico: 'COMPLETO' }), analista, file);
    const original = [...doc.fileUrls];
    jest.spyOn(Modelo, 'findOne').mockResolvedValue(doc);
    if (tipo === 'alerta') await svc.actualizarCasoConSeguimiento(numero, { nuevoEstado: 'En investigación' }, [{ ...file, originalname: 'lineamiento.pdf' }], investigador);
    else await svc.agregarSeguimiento(numero, 'En investigación', { ...file, originalname: 'lineamiento.pdf' }, investigador);
    expect(doc.fileUrls).toEqual(original);
    expect(doc.seguimientos[0].archivos).toEqual(['https://drive.google.com/uc?id=seguimiento']);
    expect(doc.seguimientos[0].archivos).not.toEqual(doc.fileUrls);
  });

  it('rechaza PDF NO_LOCALIZADO y duplicados sin subir a Drive', async () => {
    const exists = jest.spyOn(Modelo, 'exists').mockResolvedValue({ _id: new Types.ObjectId() });
    const uploadFile = jest.fn(); const save = jest.spyOn(Modelo.prototype, 'save');
    const svc: any = new service(Modelo as any, { uploadFile } as any);
    const file = { originalname: 'expediente.pdf', mimetype: 'application/pdf' } as Express.Multer.File;
    await expect(svc.incorporarHistorico(await validar(dto, minimo), analista, file)).rejects.toBeInstanceOf(BadRequestException);
    expect(exists).not.toHaveBeenCalled();
    await expect(svc.incorporarHistorico(await validar(dto, { ...minimo, estadoExpedienteHistorico: 'COMPLETO' }), analista, file)).rejects.toBeInstanceOf(ConflictException);
    expect(uploadFile).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });

  it('multipart convierte objetos, personas y año sin perder validación anidada', async () => {
    const detalles = tipo === 'alerta' ? { denunciante: JSON.stringify({ nombre: 'Persona' }), lugarDesaparicion: JSON.stringify({ municipio: 'Guatemala' }), datosLocalizacion: JSON.stringify({ fechaLocalizacion: '2020-01-01' }) }
      : { victimas: JSON.stringify([{ nombre: 'Persona', fecha_Nac: '2005-01-01' }]), lugarHechos: JSON.stringify({ municipio: 'Guatemala' }), [tipo === 'maltrato' ? 'sindicados' : 'infractores']: JSON.stringify([{ nombre: 'Otra persona' }]) };
    const multipart = { ...minimo, ...detalles, anioCaso: '2016', investigadorOriginal: JSON.stringify({ nombre: 'Original' }) };
    const payload = await validar(dto, multipart);
    expect(payload.anioCaso).toBe(2016); expect(payload.investigadorOriginal.nombre).toBe('Original');
    if (tipo !== 'alerta') expect(payload.victimas[0].fecha_Nac).toBeInstanceOf(Date);
    await expect(validar(dto, { ...multipart, investigadorOriginal: '{invalid' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(validar(dto, { ...multipart, investigadorOriginal: JSON.stringify({ usuarioId: 'invalid' }) })).rejects.toBeInstanceOf(BadRequestException);
    const campo = tipo === 'alerta' ? 'denunciante' : 'victimas';
    await expect(validar(dto, { ...multipart, [campo]: JSON.stringify(tipo === 'alerta' ? { nombre: 123 } : [{ nombre: 123 }]) })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza duplicados de cualquier estado antes de guardar', async () => {
    jest.spyOn(Modelo, 'exists').mockResolvedValue({ _id: new Types.ObjectId() });
    const save = jest.spyOn(Modelo.prototype, 'save');
    await expect(incorporarHistorico(Modelo, tipo, minimo as any, {}, analista)).rejects.toBeInstanceOf(ConflictException);
    expect(save).not.toHaveBeenCalled();
  });

  it('convierte colisiones del índice único a HTTP 409', async () => {
    jest.spyOn(Modelo, 'exists').mockResolvedValue(null);
    jest.spyOn(Modelo.prototype, 'save').mockRejectedValue({ code: 11000 });
    await expect(incorporarHistorico(Modelo, tipo, minimo as any, {}, analista)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza DEIC de otro módulo y MP incorrecto', async () => {
    await expect(incorporarHistorico(Modelo, tipo, { ...minimo, numeroDeic: 'DEIC99-2016-05-18-421' } as any, {}, analista)).rejects.toBeInstanceOf(BadRequestException);
    await expect(incorporarHistorico(Modelo, tipo, { ...minimo, numeroMp: 'XYZ' } as any, {}, analista)).rejects.toBeInstanceOf(BadRequestException);
    await expect(incorporarHistorico(Modelo, tipo, minimo as any, {}, { ...analista, role: UserRole.JEFE })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('valida la referencia del investigador original sin exigir que todavía esté activo', async () => {
    jest.spyOn(Modelo, 'exists').mockResolvedValue(null);
    const existe = jest.fn().mockResolvedValue(null);
    jest.spyOn(Modelo.db, 'model').mockReturnValue({ exists: existe } as any);
    jest.spyOn(Modelo.prototype, 'save').mockImplementation(async function () { return this; });
    const body = { ...minimo, investigadorOriginal: { usuarioId: investigador.userId } } as any;
    await expect(incorporarHistorico(Modelo, tipo, body, {}, analista)).rejects.toBeInstanceOf(BadRequestException);
    existe.mockResolvedValue({ _id: investigador.userId });
    const doc = await incorporarHistorico(Modelo, tipo, body, {}, analista);
    expect(String(doc.investigadorOriginal.usuarioId)).toBe(investigador.userId);
    expect(existe).toHaveBeenLastCalledWith({ _id: investigador.userId });
  });

  it('pide responsable para el seguimiento histórico antes de subir archivos', async () => {
    jest.spyOn(Modelo, 'findOne').mockResolvedValue(new Modelo(minimo));
    const drive = { uploadFile: jest.fn() };
    const svc: any = new service(Modelo as any, drive as any);
    const resultado = tipo === 'alerta'
      ? svc.actualizarCasoConSeguimiento(numero, { nuevoEstado: 'En investigación' }, [], analista)
      : svc.agregarSeguimiento(numero, 'En investigación', { originalname: 'respaldo.pdf' }, analista);
    await expect(resultado).rejects.toBeInstanceOf(BadRequestException);
    expect(drive.uploadFile).not.toHaveBeenCalled();
  });

  it('guarda varios seguimientos con responsables distintos sin modificar el investigador original', async () => {
    const doc = new Modelo({ ...minimo, investigadorOriginal: { nombre: 'Juan Pérez' } });
    jest.spyOn(Modelo, 'findOne').mockResolvedValue(doc);
    const usuarios = { exists: jest.fn().mockResolvedValue({ _id: investigador.userId }) };
    jest.spyOn(Modelo.db, 'model').mockReturnValue(usuarios as any);
    jest.spyOn(doc, 'save').mockImplementation(async () => { await doc.validate(); return doc; });
    const drive = { uploadFile: jest.fn().mockResolvedValue('https://example.test/respaldo.pdf') };
    const svc: any = new service(Modelo as any, drive as any);
    const otro = new Types.ObjectId().toString();
    for (const asignado of [investigador.userId, otro]) {
      if (tipo === 'alerta') await svc.actualizarCasoConSeguimiento(numero, { nuevoEstado: 'En investigación', investigadorAsignado: asignado }, [], analista);
      else await svc.agregarSeguimiento(numero, 'En investigación', { originalname: 'respaldo.pdf' }, analista, asignado);
    }
    expect(doc.get('seguimientos')).toHaveLength(2);
    expect(String(doc.get('seguimientos')[0].registradoPor)).toBe(analista.userId);
    expect(String(doc.get('seguimientos')[0].investigadorAsignado)).toBe(investigador.userId);
    expect(String(doc.get('seguimientos')[1].investigadorAsignado)).toBe(otro);
    expect(doc.get('investigadorOriginal').nombre).toBe('Juan Pérez');
  });
});

describe('Normalización y auditoría', () => {
  it('reutiliza normalización y elimina caracteres invisibles de WhatsApp', () => {
    expect(normalizeCaseNumber('\u200e deic51-2016-05-18-421\u200f')).toBe('DEIC51-2016-05-18-421');
    expect(normalizeMpNumber('\uFEFFmpe01-2016-123\u2060')).toBe('MPE01-2016-123');
  });
  it('no convierte al analista en investigador y permite autoasignación de investigadores', async () => {
    const mock = { db: { model: () => ({ exists: async () => ({ _id: investigador.userId }) }) } } as any;
    expect((await auditoriaSeguimiento(mock, analista)).investigadorAsignado).toBeUndefined();
    expect(String((await auditoriaSeguimiento(mock, investigador)).investigadorAsignado)).toBe(investigador.userId);
    const inexistente = { db: { model: () => ({ exists: async () => null }) } } as any;
    await expect(auditoriaSeguimiento(inexistente, analista, investigador.userId)).rejects.toBeInstanceOf(BadRequestException);
  });
  it.each([SeguimientoDto, UpdateCasosAlertaDto])('rechaza suplantación de auditoría en seguimientos', async dto => {
    await expect(validar(dto, { estadoInvestigacion: 'En investigación', registradoPor: investigador.userId })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('Alerta declara índices parciales para permitir múltiples MP/alertas desconocidos', () => {
    for (const campo of ['numeroMp', 'numeroAlerta']) {
      const indice = CasosAlertaSchema.indexes().find(([key]) => key[campo] === 1);
      expect(indice[1].unique).toBe(true);
      expect(indice[1].partialFilterExpression).toEqual({ [campo]: { $type: 'string' } });
    }
  });
});

describe.each([CasosAlertaController, CasosMaltratoController, CasosConflictoController])('Contrato HTTP %p', Controller => {
  it('conserva JWT y restringe incorporación a Analista/Investigador', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, Controller)).toContain(JwtAuthGuard);
    const handler = Controller.prototype.incorporarHistorico;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('historico');
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(RolesGuard);
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([UserRole.ANALISTA, UserRole.INVESTIGADOR]);
  });
  it('envía la sesión autenticada al service', async () => {
    const svc = { incorporarHistorico: jest.fn().mockResolvedValue({ _id: 'caso' }) };
    const controller = new Controller(svc as any);
    const dto = { numeroDeic: 'numero' } as any;
    await controller.incorporarHistorico(dto, { user: analista });
    expect(svc.incorporarHistorico).toHaveBeenCalledWith(dto, analista, undefined);
  });
});

// Transporte HTTP real; Drive/Mongo se sustituyen para no crear datos externos.
describe.each(casos)('Multipart HTTP: $tipo', ({ tipo, service, numero }) => {
  let app: any;
  const svc = { incorporarHistorico: jest.fn() };
  beforeAll(async () => {
    const controller = { alerta: CasosAlertaController, maltrato: CasosMaltratoController, conflicto: CasosConflictoController }[tipo];
    const module = await Test.createTestingModule({ controllers: [controller], providers: [{ provide: service, useValue: svc }] })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: context => { context.switchToHttp().getRequest().user = analista; return true; } })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });
  beforeEach(() => { svc.incorporarHistorico.mockReset().mockResolvedValue({ numeroDeic: numero }); });
  afterAll(async () => { await app?.close(); });
  it.each(['COMPLETO', 'PARCIAL'])('%s acepta file y transforma metadatos multipart', async estado => {
    await request(app.getHttpServer()).post('/' + tipo + 's/historico')
      .field('numeroDeic', numero).field('estadoExpedienteHistorico', estado)
      .field('anioCaso', '2016').field('investigadorOriginal', JSON.stringify({ nombre: 'Original' }))
      .attach('file', Buffer.from('%PDF-1.4\n'), { filename: 'expediente.pdf', contentType: 'application/pdf' }).expect(response => { if (response.status !== 201) throw new Error(JSON.stringify(response.body)); }).expect(201);
    expect(svc.incorporarHistorico).toHaveBeenCalledWith(expect.objectContaining({ anioCaso: 2016, investigadorOriginal: { nombre: 'Original' } }), analista,
      expect.objectContaining({ originalname: 'expediente.pdf', mimetype: 'application/pdf' }));
  });
  it.each(['COMPLETO', 'PARCIAL', 'NO_LOCALIZADO'])('%s conserva JSON sin PDF', async estado => {
    await request(app.getHttpServer()).post('/' + tipo + 's/historico').send({ numeroDeic: numero, estadoExpedienteHistorico: estado }).expect(201);
    expect(svc.incorporarHistorico.mock.calls[0][2]).toBeUndefined();
  });
  it('rechaza otro MIME antes del service', async () => {
    await request(app.getHttpServer()).post('/' + tipo + 's/historico')
      .field('numeroDeic', numero).field('estadoExpedienteHistorico', 'COMPLETO')
      .attach('file', Buffer.from('texto'), { filename: 'archivo.txt', contentType: 'text/plain' }).expect(400);
    expect(svc.incorporarHistorico).not.toHaveBeenCalled();
  });
});
