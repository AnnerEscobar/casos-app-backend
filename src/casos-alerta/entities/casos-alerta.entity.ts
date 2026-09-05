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

  // ───────────────────────────────────────────
  // NÚMEROS DEL CASO
  // ───────────────────────────────────────────

  @Prop({
    required: true,
    unique: true
  })
  numeroDeic: string;


  @Prop({
    required: true,
    unique: true
  })
  numeroMp: string;


  @Prop({
    required: true,
    unique: true
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