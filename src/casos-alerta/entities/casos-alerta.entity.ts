import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from 'mongoose';

@Schema()
export class CasosAlerta extends Document {
  
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
}

export const CasosAlertaSchema = SchemaFactory.createForClass(CasosAlerta);