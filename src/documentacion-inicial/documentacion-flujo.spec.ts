import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { createConnection, Types } from 'mongoose';
import { PDFDocument } from 'pdf-lib';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DocumentacionInicialService } from './documentacion-inicial.service';
import { DocumentacionInicialSchema } from './entities/documentacion-inicial.entity';
import { getPlanTemplate, getRubricaTemplate } from './templates/documentacion-inicial.templates';
import { DocumentacionInicialController } from './documentacion-inicial.controller';
import { UserRole } from '../auth/enums/user-role.enum';
import { generarDocumentacionPdf } from './documentacion-pdf';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

describe('Preparar documentos del caso asignado', () => {
  const conexion = createConnection();
  const Doc = conexion.model('DocumentacionPruebaFlujo', DocumentacionInicialSchema.clone());
  const investigadorId = String(new Types.ObjectId());
  let doc: any, caso: any, modelo: any, service: DocumentacionInicialService;

  beforeEach(() => {
    doc = null;
    caso = { _id: new Types.ObjectId(), numeroDeic: 'DEIC52-2026-10-18-001', numeroMp: 'M0030-2026-100',
      numeroAlerta: '123-2026', nombreDesaparecido: 'María López', fecha_Nac: '2014-10-20', fechaIngreso: '2026-10-18',
      investigadorAsignado: { _id: investigadorId, nombre: 'Investigador de prueba' }, expedienteEnPreparacion: true,
      estadoRegistro: 'Pendiente', direccion: { departamento: 'Jutiapa', municipio: 'Jutiapa', direccionDetallada: 'Dirección conocida' },
      victimas: [{ nombre: 'Víctima de prueba', edadReportada: 12 }], infractores: [{ nombre: 'Adolescente de prueba', edadReportada: 16 }],
      lugarHechos: { departamento: 'Jutiapa', municipio: 'Jutiapa', direccionDetallada: 'Lugar del hecho' },
    };
    const casos = { findById: jest.fn((id: string) => ({ populate: async () => String(caso?._id) === String(id) ? caso : null })), findOne: jest.fn(async () => caso) };
    modelo = {
      db: { model: jest.fn(() => casos) },
      findOne: jest.fn(async (f: any) => {
        if (!doc || f.numeroDeic && f.numeroDeic !== doc.numeroDeic || f.investigadorId && String(f.investigadorId) !== String(doc.investigadorId)) return null;
        if (f._id?.$ne && String(f._id.$ne) === String(doc._id)) return null;
        return doc;
      }),
      create: jest.fn(async (data: any) => {
        doc = new Doc(data);
        doc.save = jest.fn(async () => doc);
        return doc;
      }),
      deleteOne: jest.fn(),
    };
    service = new DocumentacionInicialService(modelo);
  });
  afterAll(async () => conexion.close());

  const crear = async (tipo: any = 'Alerta', modalidad?: any) => service.create({
    tipoCaso: tipo, casoId: String(caso._id), numeroDeic: caso.numeroDeic, modalidadMaltrato: modalidad,
    caratula: { nombre: 'Persona de prueba', lugar: 'Dirección conocida', numeroMp: caso.numeroMp, numeroAlerta: caso.numeroAlerta },
  }, investigadorId, 'Nombre de sesión');

  it('precarga el mismo DEIC, MP, persona, edad al ingreso y lugar sin crear otro documento', async () => {
    const c = await service.paraCaso('Alerta', String(caso._id), investigadorId);
    expect(c.caratula).toMatchObject({ nombre: 'María López', edad: '11', numeroMp: caso.numeroMp, lugar: 'Dirección conocida' });
    expect(c.numeroDeic).toBe(caso.numeroDeic);
    expect(c.documentacion).toBeNull(); expect(modelo.create).not.toHaveBeenCalled();
  });
  it('no inventa edad cuando falta nacimiento o fecha de ingreso', async () => {
    caso.fecha_Nac = null;
    expect((await service.paraCaso('Alerta', String(caso._id), investigadorId)).caratula.edad).toBe('');
  });
  it('reabre el borrador del mismo caso sin duplicarlo ni sobrescribir sus cambios', async () => {
    await crear(); doc.caratula.observaciones = 'Borrador conservado';
    const c = await service.paraCaso('Alerta', String(caso._id), investigadorId);
    expect(c.documentacion).toBe(doc); expect(c.documentacion.caratula.observaciones).toBe('Borrador conservado');
    expect(modelo.create).toHaveBeenCalledTimes(1);
  });
  it('abre un borrador aunque el MP o el lugar estén pendientes', async () => {
    const d = await service.create({ casoId: String(caso._id), tipoCaso: 'Alerta', numeroDeic: caso.numeroDeic,
      caratula: { nombre: 'Nombre conocido', numeroMp: '', lugar: '' } }, investigadorId, 'Sesión');
    expect(d.estado).toBe('BORRADOR'); expect(d.casoId).toBe(String(caso._id));
    expect(d.investigadorNombre).toBe('Investigador de Prueba');
  });
  it('deniega casos ajenos y no permite eludirlo omitiendo casoId', async () => {
    const ajeno = String(new Types.ObjectId());
    await expect(service.paraCaso('Alerta', String(caso._id), ajeno)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.create({ tipoCaso: 'Alerta', numeroDeic: caso.numeroDeic, caratula: { nombre: 'X', lugar: 'Y', numeroMp: caso.numeroMp } }, ajeno, 'Otro')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rechaza un DEIC diferente al caso vinculado', async () => {
    await expect(service.create({ casoId: String(caso._id), tipoCaso: 'Alerta', numeroDeic: 'DEIC52-2026-10-18-999',
      caratula: { nombre: 'X', lugar: 'Y', numeroMp: caso.numeroMp } }, investigadorId, 'Sesión')).rejects.toBeInstanceOf(ConflictException);
  });
  it('bloquea edición y eliminación después de entregar; un rechazo vuelve a habilitarlas', async () => {
    await crear(); caso.expedienteEnPreparacion = false;
    expect((await service.paraCaso('Alerta', String(caso._id), investigadorId)).editable).toBe(false);
    await expect(service.updatePlan(String(doc._id), investigadorId, { elementos: [] })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.removeDraft(String(doc._id), investigadorId)).rejects.toBeInstanceOf(ConflictException);
    caso.estadoRegistro = 'Rechazado';
    await expect(service.updatePlan(String(doc._id), investigadorId, { elementos: [] })).resolves.toBe(doc);
    expect(caso.estadoRegistro).toBe('Rechazado');
  });
  it('guarda una rúbrica parcial como borrador y rechaza su impresión incompleta', async () => {
    await crear();
    await service.updateRubrica(String(doc._id), investigadorId, { respuestas: [] });
    expect(doc.estado).toBe('BORRADOR');
    await expect(service.generarPdf(String(doc._id), investigadorId)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('conserva observaciones de ítems todavía sin responder', async () => {
    await crear();
    const item = getRubricaTemplate('Alerta').items.find(i => i.tipo === 'ITEM');
    await service.updateRubrica(String(doc._id), investigadorId, { respuestas: [{ codigo: item.codigo, observaciones: 'Pendiente de verificar' }] });
    const respuesta = (await service.getRubricaPaso(String(doc._id), investigadorId)).items.find(i => i.codigo === item.codigo);
    expect(respuesta.observaciones).toBe('Pendiente de verificar'); expect(respuesta.respuesta).toBeNull();
  });
  it('conserva nombres del mando y supervisor como datos distintos al investigador', async () => {
    await crear();
    await service.updatePlan(String(doc._id), investigadorId, { elementos: [], mandoNombre: 'Mando de prueba' });
    await service.updateRubrica(String(doc._id), investigadorId, { respuestas: [], dependenciaSupervisada: 'Sección de prueba', supervisorNombre: 'Supervisor de prueba' });
    expect((await service.getPlanPaso(String(doc._id), investigadorId)).mandoNombre).toBe('Mando de prueba');
    const r = await service.getRubricaPaso(String(doc._id), investigadorId);
    expect(r.supervisorNombre).toBe('Supervisor de prueba'); expect(r.dependenciaSupervisada).toBe('Sección de prueba');
    expect(doc.investigadorNombre).not.toBe(r.supervisorNombre);
  });
  it('verifica las diez bases sin reemplazarlas por una reconstrucción de tablas', async () => {
    const root = join(__dirname, 'assets/formatos');
    const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
    expect(Object.keys(manifest)).toHaveLength(10);
    for (const f of Object.values(manifest) as any[]) {
      const bytes = readFileSync(join(root, f.file));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(f.sha256);
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getPageCount()).toBe(1);
      expect(pdf.getPage(0).getSize()).toEqual({ width: f.width, height: f.height });
    }
  });
  it('rechaza un texto largo en vez de reducir su fuente o cambiar el formato', async () => {
    await expect(generarDocumentacionPdf({ tipoCaso: 'Alerta', numeroDeic: caso.numeroDeic,
      investigadorNombre: 'Investigador', caratula: { nombre: 'Nombre muy largo '.repeat(100) } },
      { elementos: [] }, { items: [] })).rejects.toThrow('excede el espacio del formato original');
  });
  it('no permite cambiar el DEIC vinculado ni usar códigos de otra plantilla', async () => {
    await crear();
    await expect(service.updateCaratula(String(doc._id), investigadorId, { numeroDeic: 'DEIC52-2026-10-18-999' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updatePlan(String(doc._id), investigadorId, { elementos: [{ codigo: 'INVENTADO' }] })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('el controlador impide que el analista abra documentación del investigador', () => {
    const controller = new DocumentacionInicialController(service);
    expect(() => controller.paraCaso('Alerta', String(caso._id), { user: { userId: investigadorId, role: UserRole.ANALISTA } } as any)).toThrow(ForbiddenException);
  });

  it.each([['Alerta', undefined], ['Maltrato', 'OFICIO'], ['Maltrato', 'REQUERIMIENTO'], ['Conflicto', undefined]] as const)(
    'genera PDF imprimible de %s %s sin enviar ni cambiar el caso', async (tipo, modalidad) => {
      caso.numeroDeic = `DEIC${tipo === 'Alerta' ? '52' : tipo === 'Maltrato' ? '51' : '53'}-2026-10-18-001`;
      if (tipo === 'Conflicto') caso.numeroMp = 'M0004-2026-100';
      await crear(tipo, modalidad);
      doc.caratula.edad = '12'; doc.caratula.observaciones = 'Informe';
      const id = String(doc._id);
      const plan = getPlanTemplate(tipo), rubrica = getRubricaTemplate(tipo, modalidad);
      await service.updatePlan(id, investigadorId, { mandoNombre: 'Mando de prueba', observaciones: 'Observación breve', elementos: plan.elementos.map(e => ({ codigo: e.codigo,
        informacionObtenida: 'Información con tildes y ñ.', informacionNecesitaObtener: 'Dato pendiente.', diligenciasRealizar: 'Entrevista.' })) });
      await service.updateRubrica(id, investigadorId, { conoceProtocolo: 'SI', dependenciaSupervisada: 'Sección de prueba', supervisorNombre: 'Supervisor de prueba', respuestas: rubrica.items.filter(i => i.tipo === 'ITEM').map(i => ({ codigo: i.codigo, respuesta: 'SI', observaciones: 'OK' })) });
      const pdf = await service.generarPdf(id, investigadorId);
      expect(pdf.buffer.subarray(0, 4).toString()).toBe('%PDF');
      const parsed = await PDFDocument.load(pdf.buffer);
      expect(parsed.getPageCount()).toBe(3);
      expect(parsed.getPages()[0].getWidth()).toBeLessThan(parsed.getPages()[0].getHeight());
      expect(parsed.getPages()[1].getWidth()).toBeLessThan(parsed.getPages()[1].getHeight());
      expect(parsed.getPages()[2].getSize()).toEqual({ width: 612, height: 792 });
      const medidas = tipo === 'Alerta' ? [{ width: 612.12, height: 949.8 }, { width: 612, height: 1008 }]
        : tipo === 'Maltrato' ? [{ width: 612.12, height: 923.16 }, { width: 609.12, height: 892.92 }]
        : [{ width: 612.12, height: 923.16 }, { width: 612, height: 1008 }];
      expect(parsed.getPage(0).getSize()).toEqual(medidas[0]); expect(parsed.getPage(1).getSize()).toEqual(medidas[1]);
      expect(doc.estado).toBe('BORRADOR'); expect(caso.expedienteEnPreparacion).toBe(true); expect(caso.estadoRegistro).toBe('Pendiente');
      if (process.env.PDF_REVIEW_DIR) {
        mkdirSync(process.env.PDF_REVIEW_DIR, { recursive: true });
        writeFileSync(join(process.env.PDF_REVIEW_DIR, `${tipo}-${modalidad || 'general'}.pdf`), pdf.buffer);
      }
    },
  );
});
