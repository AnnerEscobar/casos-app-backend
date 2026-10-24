import { createConnection, Schema, Types } from 'mongoose';
import { textosMayusculasPlugin } from './textos-mayusculas';
import { CasosAlertaSchema } from '../casos-alerta/entities/casos-alerta.entity';
import { CasosMaltratoSchema } from '../casos-maltrato/entities/casos-maltrato.entity';
import { CasosConflictoSchema } from '../casos-conflicto/entities/casos-conflicto.entity';
import { UsuarioSchema } from '../auth/entities/auth.entity';
import { CaratulaSchema } from '../caratulas/entities/caratula.entity';
import { DocumentacionInicialSchema } from '../documentacion-inicial/entities/documentacion-inicial.entity';
import { SolicitudAccesoSchema } from '../busquedas/solicitud-acceso.schema';

const copiar = (v: any): any => {
  if (!v || typeof v !== 'object' || v instanceof Types.ObjectId) return v;
  if (v instanceof Date) return new Date(v);
  if (Array.isArray(v)) return v.map(copiar);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, copiar(x)]));
};

describe('Mayúsculas persistidas y presentación original (middleware Mongoose real)', () => {
  const conexion = createConnection();
  const schema = new Schema({
    nombre: String, observacion: String, email: String, password: String, token: String,
    estado: { type: String, enum: ['Pendiente', 'Aprobado'] },
    fecha: Date, cantidad: Number, activo: Boolean,
    detalle: { type: Object }, fileUrls: [String],
    personas: [{ nombre: String, departamento: String }],
    seguimientos: { type: Array, default: [] },
  }, { bufferCommands: false });
  schema.plugin(textosMayusculasPlugin);
  const Modelo = conexion.model('TextoPrueba', schema);
  let guardado: any;
  let actualizacion: any;
  let proyeccion: any;

  beforeEach(() => {
    guardado = undefined; actualizacion = undefined; proyeccion = undefined;
    jest.spyOn(Modelo.collection, 'insertOne').mockImplementation(async (doc: any) => {
      guardado = copiar(doc);
      return { acknowledged: true, insertedId: doc._id } as any;
    });
    jest.spyOn(Modelo.collection, 'updateOne').mockImplementation(async (_filter: any, update: any) => {
      actualizacion = copiar(update);
      return { acknowledged: true, matchedCount: 1, modifiedCount: 1 } as any;
    });
    jest.spyOn(Modelo.collection, 'findOne').mockImplementation(async (_filter: any, options: any) => {
      proyeccion = options?.projection;
      const result = copiar(guardado);
      if (proyeccion?.nombre === 1) return { _id: result._id, nombre: result.nombre, _presentacionTextos: result._presentacionTextos };
      return result;
    });
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => { await conexion.close(); });

  it('envía MAYÚSCULAS al driver, preserva tildes/ñ y devuelve el texto escrito', async () => {
    const doc = await Modelo.create({ nombre: 'María López', observacion: 'Niña en investigación.' });
    expect(guardado.nombre).toBe('MARÍA LÓPEZ');
    expect(guardado.observacion).toBe('NIÑA EN INVESTIGACIÓN.');
    expect(doc.nombre).toBe('María López');
    expect(doc.isModified()).toBe(false);
    expect(doc.toJSON().nombre).toBe('María López');
    expect(JSON.stringify(doc)).not.toContain('_presentacionTextos');
  });

  it('conserva el texto al volver a consultar, con documento y con lean', async () => {
    await Modelo.create({ nombre: 'Maria Lopez' });
    expect((await Modelo.findOne({})).nombre).toBe('Maria Lopez');
    const plano: any = await Modelo.findOne({}).lean();
    expect(plano.nombre).toBe('Maria Lopez');
    expect(plano._presentacionTextos).toBeUndefined();
    expect(guardado.nombre).toBe('MARIA LOPEZ');
  });

  it('respeta proyecciones sin exponer datos personales excluidos', async () => {
    await Modelo.create({ nombre: 'Maria Lopez', observacion: 'Dato reservado' });
    const doc = await Modelo.findOne({}).select('nombre');
    expect(doc.nombre).toBe('Maria Lopez');
    expect(doc.toJSON().observacion).toBeUndefined();
    expect((doc.toJSON() as any)._presentacionTextos).toBeUndefined();
    const plano: any = await Modelo.findOne({}).select('nombre').lean();
    expect(plano.nombre).toBe('Maria Lopez');
    expect(plano.observacion).toBeUndefined();
    expect(proyeccion._presentacionTextos).toBe(1);
  });

  it('normaliza subdocumentos, arreglos y objetos libres sin tocar enlaces o controles', async () => {
    await Modelo.create({
      personas: [{ nombre: 'José Pérez', departamento: 'Jutiapa' }],
      detalle: { descripcion: 'Una reseña', fotoUrl: 'https://drive/aBc', camarasEstado: 'hay', fechaInforme: '2026-10-18' },
      seguimientos: [{ nuevoEstado: 'Remitido', nombreAcompanante: 'Ana Pérez', archivos: ['https://drive/XyZ'] }],
    });
    expect(guardado.personas[0].nombre).toBe('JOSÉ PÉREZ');
    expect(guardado.personas[0].departamento).toBe('JUTIAPA');
    expect(guardado.detalle.descripcion).toBe('UNA RESEÑA');
    expect(guardado.detalle.fotoUrl).toBe('https://drive/aBc');
    expect(guardado.detalle.camarasEstado).toBe('hay');
    expect(guardado.detalle.fechaInforme).toBe('2026-10-18');
    expect(guardado.seguimientos[0].nombreAcompanante).toBe('ANA PÉREZ');
    expect(guardado.seguimientos[0].nuevoEstado).toBe('Remitido');
    expect(guardado.seguimientos[0].archivos).toEqual(['https://drive/XyZ']);
    const doc = await Modelo.findOne({});
    expect(doc.personas[0].nombre).toBe('José Pérez');
    expect(doc.detalle.descripcion).toBe('Una reseña');
  });

  it('no cambia credenciales, estados, fechas, ceros o booleanos', async () => {
    const fecha = new Date('2026-10-18T12:15:00Z');
    await Modelo.create({ nombre: null, email: 'Maria@Ejemplo.com', password: '$2b$AbCd', token: 'aBc.XyZ', estado: 'Pendiente', fecha, cantidad: 0, activo: false, fileUrls: ['https://drive/AbC'] });
    expect(guardado).toMatchObject({ nombre: null, email: 'Maria@Ejemplo.com', password: '$2b$AbCd', token: 'aBc.XyZ', estado: 'Pendiente', cantidad: 0, activo: false, fecha });
    expect(guardado.fileUrls).toEqual(['https://drive/AbC']);
  });

  it('leer un registro anterior no lo migra; editarlo normaliza y conserva su presentación', async () => {
    guardado = { _id: new Types.ObjectId(), nombre: 'Nombre anterior', observacion: 'Texto anterior' };
    const doc = await Modelo.findOne({});
    expect(doc.nombre).toBe('Nombre anterior');
    expect(actualizacion).toBeUndefined();
    expect(guardado._presentacionTextos).toBeUndefined();
    doc.nombre = 'Nuevo Nombre';
    await doc.save();
    expect(actualizacion.$set.nombre).toBe('NUEVO NOMBRE');
    expect(actualizacion.$set.observacion).toBe('TEXTO ANTERIOR');
    expect(doc.nombre).toBe('Nuevo Nombre');
    expect(doc.observacion).toBe('Texto anterior');
  });

  it('una segunda edición actualiza también la presentación, sin recuperar un nombre antiguo', async () => {
    await Modelo.create({ nombre: 'Maria Lopez' });
    const doc = await Modelo.findOne({});
    doc.nombre = 'MARIA LOPEZ';
    await doc.save();
    expect(doc.nombre).toBe('MARIA LOPEZ');
    const raw = { ...guardado, ...actualizacion.$set };
    expect(Modelo.hydrate(raw).nombre).toBe('MARIA LOPEZ');
  });

  it('elimina presentaciones de personas retiradas y no intercambia nombres al reordenar', async () => {
    await Modelo.create({ personas: [{ nombre: 'Ana' }, { nombre: 'José' }] });
    const doc = await Modelo.findOne({});
    doc.set('personas', [{ nombre: 'José' }]);
    await doc.save();
    expect(doc.personas.map(p => p.nombre)).toEqual(['José']);
    expect(Object.values(actualizacion.$set._presentacionTextos).some((x: any) => x.ruta === 'personas.1.nombre')).toBe(false);
  });

  it('restaura la escritura original también cuando el driver rechaza save', async () => {
    (Modelo.collection.insertOne as jest.Mock).mockRejectedValueOnce(new Error('Escritura rechazada'));
    const doc = new Modelo({ nombre: 'María López' });
    await expect(doc.save()).rejects.toThrow('Escritura rechazada');
    expect(doc.nombre).toBe('María López');
  });

  it('normaliza actualizaciones atómicas y guarda presentación en la misma operación', async () => {
    await Modelo.updateOne({ _id: new Types.ObjectId() }, { $set: { nombre: 'María López', estado: 'Aprobado' } });
    expect(actualizacion.$set.nombre).toBe('MARÍA LÓPEZ');
    expect(actualizacion.$set.estado).toBe('Aprobado');
    expect(Object.values(actualizacion.$set).some((x: any) => x?.original === 'María López')).toBe(true);
  });

  it('sustituye un objeto con datos en mayúsculas sin generar rutas de actualización incompatibles', async () => {
    await Modelo.updateOne({}, { $set: { detalle: { descripcion: 'Reseña nueva', fotoUrl: 'https://drive/AbC' } } });
    expect(actualizacion.$set.detalle).toEqual({ descripcion: 'RESEÑA NUEVA', fotoUrl: 'https://drive/AbC' });
    expect(actualizacion.$set['detalle.descripcion']).toBeUndefined();
  });

  it('guardar una proyección conserva la presentación de campos no leídos', async () => {
    await Modelo.create({ nombre: 'Maria Lopez', observacion: 'Texto reservado' });
    const doc = await Modelo.findOne({}).select('nombre');
    doc.nombre = 'Maria Pérez';
    await doc.save();
    const completo = Modelo.hydrate({ ...guardado, ...actualizacion.$set });
    expect(completo.nombre).toBe('Maria Pérez');
    expect(completo.observacion).toBe('Texto reservado');
  });

  it('un seguimiento agregado conserva los valores previos y la escritura atómica', async () => {
    await Modelo.create({ seguimientos: [{ nombreAcompanante: 'Ana', nuevoEstado: 'Informado' }] });
    const doc = await Modelo.findOne({});
    doc.seguimientos.push({ nombreAcompanante: 'José', nuevoEstado: 'Remitido' });
    await doc.save();
    expect(doc.seguimientos.map(s => s.nombreAcompanante)).toEqual(['Ana', 'José']);
    expect(JSON.stringify(actualizacion)).toContain('JOSÉ');
    expect(JSON.stringify(actualizacion)).toContain('Remitido');
    // Un mismo array no puede tener $push y $set simultáneamente en MongoDB.
    expect(!(actualizacion.$push?.seguimientos && Object.keys(actualizacion.$set || {}).some(p => p.startsWith('seguimientos.')))).toBe(true);
  });

  it.each([
    ['Alerta', CasosAlertaSchema], ['Maltrato', CasosMaltratoSchema], ['Conflicto', CasosConflictoSchema],
    ['Usuario', UsuarioSchema], ['Caratula', CaratulaSchema],
    ['DocumentacionInicial', DocumentacionInicialSchema], ['SolicitudAcceso', SolicitudAccesoSchema],
  ])('instala la política en el esquema real %s', (_nombre, realSchema) => {
    expect((realSchema as Schema).path('_presentacionTextos')).toBeDefined();
  });

  it.each([
    ['Alerta', CasosAlertaSchema, { nombreDesaparecido: 'María López', estadoInvestigacion: 'Informado', procesoAlerta: true }, 'nombreDesaparecido'],
    ['Maltrato', CasosMaltratoSchema, { victimas: [{ nombre: 'María López' }], estadoInvestigacion: 'Informado', procesoMaltrato: true }, 'victimas.0.nombre'],
    ['Conflicto', CasosConflictoSchema, { infractores: [{ nombre: 'María López' }], estadoInvestigacion: 'Informado', procesoConflicto: true }, 'infractores.0.nombre'],
    ['Usuario', UsuarioSchema, { nombre: 'María López', email: 'Maria@Ejemplo.com', password: '$2b$AbCd', role: 'Investigador' }, 'nombre'],
    ['Caratula', CaratulaSchema, { tipoCaso: 'Alerta', nombre: 'María López' }, 'nombre'],
    ['DocumentacionInicial', DocumentacionInicialSchema, { tipoCaso: 'Alerta', investigadorNombre: 'María López' }, 'investigadorNombre'],
    ['SolicitudAcceso', SolicitudAccesoSchema, { tipo: 'alerta', motivo: 'María López' }, 'motivo'],
  ])('persiste y vuelve a leer el esquema real %s conservando su contrato', async (nombre, realSchema, datos, ruta) => {
    const Real = conexion.model(`Real${nombre}`, (realSchema as Schema).clone());
    let raw: any;
    jest.spyOn(Real.collection, 'insertOne').mockImplementation(async (doc: any) => {
      raw = copiar(doc);
      return { acknowledged: true, insertedId: doc._id } as any;
    });
    const leer = (obj: any) => (ruta as string).split('.').reduce((v, k) => v?.[k], obj);
    const doc = new Real({ numeroDeic: 'DEIC52-2026-10-18-001', numeroMp: 'MP-001', ...datos as any });
    // Aquí se aísla el contrato de almacenamiento de los campos obligatorios
    // de cada formulario, cubiertos por las suites de gestión e históricos.
    await doc.save({ validateBeforeSave: false });
    expect(leer(raw)).toBe('MARÍA LÓPEZ');
    expect(leer(doc)).toBe('María López');
    const consultado = Real.hydrate(raw);
    expect(leer(consultado)).toBe('María López');
    expect(JSON.stringify(consultado)).not.toContain('_presentacionTextos');
    for (const control of ['tipo', 'tipoCaso', 'tipoInforme', 'estadoInvestigacion', 'email', 'password', 'role']) {
      if (control in (datos as any)) expect(raw[control]).toBe((datos as any)[control]);
    }
  });
});
