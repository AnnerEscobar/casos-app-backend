import { configurarCasoHistorico, MetadatosCasoHistorico } from '../../common/historicos/caso-historico.schema';
import { FichaAlertaSchema } from './ficha-alerta.schema';
import {
  Prop,
  Schema,
  SchemaFactory
} from '@nestjs/mongoose';

import {
  Document,
  Types
} from 'mongoose';

import {
  EstadoRegistro
} from '../../common/enums/estado-registro.enum';

import {
  TipoRevisionRegistro
} from '../../common/enums/tipo-revision-registro.enum';


export type CasosAlertaDocument =
  CasosAlerta & Document;


// ─────────────────────────────────────────────
// HISTORIAL DE REVISIÓN DEL REGISTRO
// ─────────────────────────────────────────────

@Schema({ _id: false })
export class RevisionRegistroAlerta {

  @Prop({
    type: String,
    enum: Object.values(TipoRevisionRegistro),
    required: true,
  })
  tipo: TipoRevisionRegistro;


  @Prop({
    type: Types.ObjectId,
    ref: 'Usuario',
    required: true,
  })
  usuario: Types.ObjectId;


  @Prop({
    type: Date,
    default: Date.now,
  })
  fecha: Date;


  @Prop({
    type: String,
    trim: true,
    default: null,
  })
  observacion?: string | null;


  @Prop({
    type: String,
    default: null,
  })
  archivoUrl?: string | null;
}


export const RevisionRegistroAlertaSchema =
  SchemaFactory.createForClass(
    RevisionRegistroAlerta
  );


// ─────────────────────────────────────────────
// ESQUEMA PRINCIPAL DE ALERTA
// ─────────────────────────────────────────────

@Schema({ timestamps: true })
export class CasosAlerta {
  @Prop({ default: false }) procesoAlerta?: boolean;
  @Prop({ default: false }) expedienteEnPreparacion?: boolean;
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) investigadorAsignado?: Types.ObjectId;
  @Prop({ type: Date }) fechaIngreso?: Date;
  @Prop({ type: Date }) fechaEnvioRevision?: Date;
  @Prop({ type: FichaAlertaSchema, default: undefined }) fichaAlerta?: Record<string, any>;

  // ───────────────────────────────────────────
  // NÚMEROS DEL CASO
  // ───────────────────────────────────────────

  @Prop({
    required: true,
    unique: true
  })
  numeroDeic: string;


  @Prop({
    required: true
  })
  numeroMp: string;


  @Prop({
    required: true
  })
  numeroAlerta: string;


  // ───────────────────────────────────────────
  // PERSONA DESAPARECIDA
  // ───────────────────────────────────────────

  @Prop({ required: true })
  nombreDesaparecido: string;


  @Prop({ required: true })
  fecha_Nac: Date;


  // ───────────────────────────────────────────
  // ESTADO DE LA INVESTIGACIÓN
  // ───────────────────────────────────────────

  @Prop({ required: true })
  estadoInvestigacion: string;


  // ───────────────────────────────────────────
  // CONTROL DE REGISTRO / AUTORIZACIÓN
  // ───────────────────────────────────────────

  @Prop({
    type: String,
    enum: Object.values(EstadoRegistro),
    default: EstadoRegistro.APROBADO,
    required: true,
  })
  estadoRegistro: EstadoRegistro;


  @Prop({
    type: Types.ObjectId,
    ref: 'Usuario',
    default: null,
  })
  registradoPor?: Types.ObjectId | null;


  @Prop({
    type: Types.ObjectId,
    ref: 'Usuario',
    default: null,
  })
  revisadoPor?: Types.ObjectId | null;


  @Prop({
    type: Date,
    default: null,
  })
  fechaRevision?: Date | null;


  @Prop({
    type: String,
    default: null,
    trim: true,
  })
  motivoRechazo?: string | null;


  @Prop({
    type: [RevisionRegistroAlertaSchema],
    default: [],
  })
  historialRevisiones: RevisionRegistroAlerta[];


  // ───────────────────────────────────────────
  // DATOS ADICIONALES DE LA ALERTA
  // ───────────────────────────────────────────

  @Prop({ required: false })
  origenAlerta?: string;


  @Prop({ required: false })
  casaHogar?: string;


  @Prop({ required: false })
  ubicacionGps?: string;


  // ───────────────────────────────────────────
  // LUGAR DE LA DESAPARICIÓN
  //
  // Se conserva "direccion" en MongoDB
  // por compatibilidad con V2.
  // En V3 el DTO lo maneja como
  // lugarDesaparicion.
  // ───────────────────────────────────────────

  @Prop({
    type: {
      departamento: String,
      municipio: String,
      direccionDetallada: String,
    },
    required: true,
  })
  direccion: {
    departamento: string;
    municipio: string;
    direccionDetallada: string;
  };


  // ───────────────────────────────────────────
  // DENUNCIANTE
  //
  // Opcional en el schema para conservar
  // compatibilidad con Alertas V2.
  // ───────────────────────────────────────────

  @Prop({
    type: {
      nombre: String,
      cui: String,
      telefono: String,
    },
    required: false,
  })
  denunciante?: {
    nombre: string;
    cui?: string;
    telefono?: string;
  };


  // ───────────────────────────────────────────
  // DOCUMENTOS
  // ───────────────────────────────────────────

  @Prop({
    type: [String],
    default: [],
  })
  fileUrls: string[];


  // ───────────────────────────────────────────
  // DATOS DE LOCALIZACIÓN
  //
  // Se conservan estos nombres por
  // compatibilidad con V2.
  // ───────────────────────────────────────────

  @Prop({ required: false })
  direccionLocalizacion?: string;


  @Prop({ required: false })
  nombreAcompanante?: string;


  @Prop({ required: false })
  telefono?: string;


  @Prop({ required: false })
  horaLocalizacion?: string;


  @Prop({ required: false })
  fechaLocalizacion?: Date;


  // ───────────────────────────────────────────
  // SEGUIMIENTOS
  // ───────────────────────────────────────────

  @Prop({
    type: Array,
    default: []
  })
  seguimientos?: {

    registradoPor?: Types.ObjectId;
    investigadorAsignado?: Types.ObjectId;
    nuevoEstado: string;

    fecha: Date;

    nombreAcompanante?: string;

    telefono?: string;

    direccionLocalizacion?: string;

    horaLocalizacion?: string;

    fechaLocalizacion?: Date;

    archivos: string[];

  }[];
}


export const CasosAlertaSchema =
  SchemaFactory.createForClass(
    CasosAlerta
  );
export interface CasosAlerta extends MetadatosCasoHistorico {}
configurarCasoHistorico(CasosAlertaSchema, ["numeroMp","numeroAlerta","nombreDesaparecido","fecha_Nac","estadoInvestigacion","direccion"]);
// El registro inicial normal admite datos pendientes sin alterar el contrato histórico.
for (const campo of ['numeroMp', 'numeroAlerta', 'fecha_Nac', 'estadoInvestigacion', 'direccion']) {
  const path = CasosAlertaSchema.path(campo) as any;
  // Sustituir todas las reglas previas: required() agrega validadores.
  path.validators = path.validators.filter((v: any) => v.type !== 'required');
  path.required(function () {
    return this.origenCaso !== 'HISTORICO' && !this.procesoAlerta;
  });
}
CasosAlertaSchema.set('optimisticConcurrency', true);
CasosAlertaSchema.index({ numeroMp: 1 });
CasosAlertaSchema.index({ numeroAlerta: 1 }, { unique: true, partialFilterExpression: { numeroAlerta: { $type: 'string' } } });
