import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { EstadoRegistro } from '../../common/enums/estado-registro.enum';
import { TipoRevisionRegistro } from '../../common/enums/tipo-revision-registro.enum';

export type CasosMaltratoDocument = CasosMaltrato & Document;

@Schema({ _id: false })
export class RevisionRegistro {

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

// Subdocumento para infractores y víctimas
@Schema({ _id: false, timestamps: true }) // No genera un _id independiente para cada subdocumento

export class VictimaInfractor {

  @Prop({ required: true })
  nombre: string;

  @Prop({ required: true })
  cui: string;

  @Prop({ required: true })
  fecha_Nac: Date;

  @Prop({ required: true })
  direccion: string;
}

// Subdocumento para seguimientos
@Schema({ _id: false, timestamps: true })
export class Seguimiento {
  @Prop({ default: Date.now })
  fecha: Date;

  @Prop({ required: true })
  estado: string;

  @Prop({ type: [String], required: true })
  archivos: string[];
}

export const RevisionRegistroSchema = SchemaFactory.createForClass(RevisionRegistro);

// Esquema principal
@Schema({ timestamps: true }) // Agrega createdAt y updatedAt automáticamente
export class CasosMaltrato extends Document {
  @Prop({
    required: true,
    match: /^DEIC51-\d{4}-\d{2}-\d{2}-\d+$/,
  })
  numeroDeic: string;

  @Prop({
    required: true,
    match: [
      /^(?:(?:MPE01|M0008|MP004|M0030|MP001)-\d{4}-\d+|IC\/PNCORLLAT\d+-\d{4}-\d+)$/,
      'El numeroMp debe seguir uno de estos formatos: ' +
      'MPE01-AAAA-NNNN, M0008-AAAA-NNNN, IC/PNCORLLATXXX-AAAA-NNNN, MP004-AAAA-NNNN, M0030-AAAA-NNNN o MP001-AAAA-NNNN'
    ],
  })
  numeroMp: string;


  @Prop({ required: true })
  estadoInvestigacion: string;

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
  registradoPor?: Types.ObjectId;


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
    type: [RevisionRegistroSchema],
    default: [],
  })
  historialRevisiones: RevisionRegistro[];

  @Prop({ type: [VictimaInfractor], required: true })
  infractores: VictimaInfractor[];

  @Prop({ type: [VictimaInfractor], required: true })
  victimas: VictimaInfractor[];

  @Prop({ type: [String], default: [] })
  fileUrls: string[];

  @Prop({ type: [Seguimiento], default: [] })
  seguimientos: Seguimiento[];
}

// Genera los esquemas
export const VictimaInfractorSchema = SchemaFactory.createForClass(VictimaInfractor);
export const SeguimientoSchema = SchemaFactory.createForClass(Seguimiento);
export const CasosMaltratoSchema = SchemaFactory.createForClass(CasosMaltrato);