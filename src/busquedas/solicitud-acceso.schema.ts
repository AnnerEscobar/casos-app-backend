import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
@Schema({ timestamps: true })
export class SolicitudAcceso {
    @Prop({ required: true, enum: ['alerta', 'maltrato', 'conflicto'] })
    tipo: string;
    @Prop({ type: Types.ObjectId, required: true })
    casoId: Types.ObjectId;
    @Prop({ required: true })
    numeroDeic: string;
    @Prop({
        type: Types.ObjectId, ref: 'Usuario', required: true
    })
    solicitante: Types.ObjectId;
    @Prop({ type: Types.ObjectId, ref: 'Usuario' })
    responsable?: Types.ObjectId;
    @Prop({ required: true, maxlength: 1000 })
    motivo: string;
    @Prop({ enum: ['PENDIENTE', 'AUTORIZADA', 'RECHAZADA', 'REVOCADA'], default: 'PENDIENTE' })
    estado: string;
    @Prop({ default: Date.now })
    fechaSolicitud: Date;
    @Prop({ type: Types.ObjectId, ref: 'Usuario' })
    resueltoPor?: Types.ObjectId;
    @Prop()
    fechaResolucion?: Date;
    @Prop({ type: Types.ObjectId, ref: 'Usuario' })
    revocadoPor?: Types.ObjectId;
    @Prop()
    fechaRevocacion?: Date;
}
export const SolicitudAccesoSchema = SchemaFactory.createForClass(SolicitudAcceso);
SolicitudAccesoSchema.index({
    tipo: 1, casoId: 1, solicitante: 1
}, { unique: true });
SolicitudAccesoSchema.index({ responsable: 1, estado: 1 });
