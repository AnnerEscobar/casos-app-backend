import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CaratulaDocument = Caratula & Document;

@Schema({ timestamps: true })
export class Caratula {
  @Prop({ required: true })
  tipoCaso: 'Alerta' | 'Maltrato' | 'Conflicto';

  @Prop({ required: true, unique: true })
  numeroDeic: string;

  @Prop()
  numeroMp: string;

  @Prop()
  numeroAlerta?: string;

  @Prop()
  nombre: string;

  @Prop()
  fecha_Nac?: Date;

  @Prop()
  lugar: string;

  @Prop()
  departamento?: string;

  @Prop()
  municipio?: string;

  @Prop()
  observaciones?: string;

  @Prop()
  investigador: string;
}

export const CaratulaSchema = SchemaFactory.createForClass(Caratula);
