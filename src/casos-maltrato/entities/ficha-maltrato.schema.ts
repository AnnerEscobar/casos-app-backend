import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
@Schema({_id:false})
export class FichaMaltrato {
  @Prop({type:String,trim:true}) procedencia?: string;
  @Prop({type:String,trim:true}) tipoDocumento?: string;
  @Prop({type:Date}) fechaDocumento?: Date;
  @Prop({type:String,trim:true}) unidadConoce?: string;
  @Prop({type:String,trim:true}) zonaHecho?: string;
  @Prop({type:Date}) fechaHecho?: Date;
  @Prop({type:String,trim:true}) horaHecho?: string;
  @Prop({type:String,trim:true}) movilHecho?: string;
  @Prop({type:String,trim:true}) modusOperandi?: string;
  @Prop({type:String,trim:true}) circunstanciaVictima?: string;
  @Prop({type:String,trim:true}) resenaHecho?: string;
  @Prop({type:String,trim:true}) logrosObtenidos?: string;
  @Prop({type:Date}) fechaInformadoMp?: Date;
  @Prop({type:String,trim:true}) numeroOficioMp?: string;
  @Prop({type:String,trim:true}) tipoAtencion?: string;
  @Prop({type:String,trim:true}) clasificacionCaso?: string;
  @Prop({type:Date}) fechaEntregaAnalisis?: Date;
  @Prop({type:String,trim:true}) observaciones?: string;
  @Prop({type:Number,min:0,max:1000000,validate:Number.isInteger}) camarasUbicadas?: number;
  @Prop({type:Number,min:0,max:1000000,validate:Number.isInteger}) camarasSolicitadas?: number;
  @Prop({type:Number,min:0,max:1000000,validate:Number.isInteger}) camarasExtraidas?: number;
  @Prop({type:Number,min:0,max:1000000,validate:Number.isInteger}) fotogramas?: number;
  @Prop({type:Number,min:0,max:1000000,validate:Number.isInteger}) allanamientosSolicitados?: number;
  @Prop({type:Number,min:0,max:1000000,validate:Number.isInteger}) allanamientosEjecutados?: number;
  @Prop({type:Number,min:0,max:1000000,validate:Number.isInteger}) allanamientosAutorizados?: number;
  @Prop({type:Number,min:0,max:1000000,validate:Number.isInteger}) aprehensionesSolicitadas?: number;
  @Prop({type:Number,min:0,max:1000000,validate:Number.isInteger}) aprehensionesEjecutadas?: number;
  @Prop({type:Number,min:0,max:1000000,validate:Number.isInteger}) aprehensionesAutorizadas?: number;
  @Prop({type:Number,min:0,max:1000000,validate:Number.isInteger}) entrevistas?: number;
}
export const FichaMaltratoSchema=SchemaFactory.createForClass(FichaMaltrato);
