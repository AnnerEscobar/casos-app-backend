import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UsuarioDocument = Usuario & Document;

@Schema()
export class Usuario {

    _id?: string; // Mongoose maneja el ID automáticamente, pero puedes definirlo aquí si lo necesitas

    @Prop({ required: true, unique: true })
    email: string;

    @Prop({ required: true })
    password: string;

    @Prop()
    token?: string;

    @Prop()
    role?: string;
}


export const UsuarioSchema = SchemaFactory.createForClass(Usuario);
