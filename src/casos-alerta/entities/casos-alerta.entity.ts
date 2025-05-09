import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from 'mongoose';


export type CasosAlertaDocument = CasosAlerta & Document;

@Schema()
export class CasosAlerta {

  @Prop({ required: true, unique: true })
  numeroDeic: string;

  @Prop({ required: true, unique: true })
  numeroMp: string;

  @Prop({ required: true, unique: true })
  numeroAlerta: string;

  @Prop({ required: true })
  nombreDesaparecido: string;

  @Prop({ required: true })
  fecha_Nac: Date;

  @Prop({ required: true })
  estadoInvestigacion: string;

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

  @Prop()
  fileUrls: string;

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

  @Prop({ type: Array, default: [] })
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

export const CasosAlertaSchema = SchemaFactory.createForClass(CasosAlerta);