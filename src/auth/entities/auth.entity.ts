import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRole } from '../enums/user-role.enum';

export type UsuarioDocument = Usuario & Document;

@Schema({ collection: 'users', timestamps: true })
export class Usuario {

    _id?: string; // Mongoose maneja el ID automáticamente, pero puedes definirlo aquí si lo necesitas

    @Prop({ required: true, unique: true })
    email: string;

    @Prop({ required: true })
    password: string;

    @Prop()
    token?: string;

    @Prop({type: String, enum: Object.values(UserRole), default: UserRole.INVESTIGADOR, requiered: true})
    role?: UserRole;
}


export const UsuarioSchema = SchemaFactory.createForClass(Usuario);
