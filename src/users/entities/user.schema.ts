import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true }) // Agrega createdAt y updatedAt automáticamente
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: 'investigador' })
  role: string;

  @Prop({ default: null }) // Para manejar sesiones únicas
  token: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
