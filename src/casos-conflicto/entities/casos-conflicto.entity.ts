import { Optional } from '@nestjs/common';
import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CasosConflictoDocument = CasosConflicto & Document;

// Subdocumento para infractores y víctimas
@Schema({ _id: false }) // No genera un _id independiente para cada subdocumento

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

// Esquema principal
@Schema({ timestamps: true }) // Agrega createdAt y updatedAt automáticamente
export class CasosConflicto  extends Document {
  @Prop({
    required: true,
    match: /^DEIC53-\d{4}-\d{2}-\d{2}-\d+$/,
  })
  numeroDeic: string;

  @Prop({
    required: true,
    match: /^M0030-\d{4}-\d+$/,
  })
  numeroMp: string;

  @Prop({ required: true })
  estadoInvestigacion: string;

  @Prop({ type: [VictimaInfractor], required: true })
  infractores: VictimaInfractor[];

  @Prop({ type: [VictimaInfractor], required: true })
  victimas: VictimaInfractor[];

  @Prop({ type: [String], required: Optional })
  fileUrls: string[];
}

// Genera los esquemas
export const VictimaInfractorSchema = SchemaFactory.createForClass(VictimaInfractor);
export const CasosConflictoSchema = SchemaFactory.createForClass(CasosConflicto);
