import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
@Schema({_id:false})
export class FichaConflicto {
  @Prop({type:String,trim:true}) seccionConoce?: string;
  @Prop({type:String,trim:true}) hechoInvestigar?: string;
  @Prop({type:Date}) fechaAsignacion?: Date;
  @Prop({type:String,trim:true}) institucionRemitente?: string;
  @Prop({type:String,trim:true}) procedencia?: string;
  @Prop({type:String,trim:true}) tipoDocumento?: string;
  @Prop({type:Date}) fechaDocumento?: Date;
  @Prop({type:String,trim:true}) emplazamiento?: string;
  @Prop({type:String,trim:true}) firmanteNombre?: string;
  @Prop({type:String,trim:true}) firmanteCargo?: string;
  @Prop({type:String,trim:true}) lineamientosMp?: string;
  @Prop({type:String,trim:true}) resenaHecho?: string;
  @Prop({type:String,trim:true}) movilHecho?: string;
  @Prop({type:String,trim:true}) modusOperandi?: string;
  @Prop({type:String,trim:true}) hipotesisHecho?: string;
  @Prop({type:Date}) fechaHecho?: Date;
  @Prop({type:String,trim:true}) horaHecho?: string;
  @Prop({type:String,trim:true}) lugarHecho?: string;
  @Prop({type:String,trim:true}) lugarDetencion?: string;
  @Prop({type:String,trim:true}) aldeaColoniaBarrio?: string;
  @Prop({type:String,trim:true}) zonaHecho?: string;
  @Prop({type:String,trim:true}) demarcacionComisaria?: string;
  @Prop({type:String,trim:true}) tipoVehiculo?: string;
  @Prop({type:String,trim:true}) tipoPlacas?: string;
  @Prop({type:String,trim:true}) numeroPlacas?: string;
  @Prop({type:String,trim:true}) tipoAtencion?: string;
  @Prop({type:Date}) fechaPrimerInforme?: Date;
  @Prop({type:Number,min:0,max:1000000,validate:Number.isInteger}) folios?: number;
  @Prop({type:Number,min:0,max:1000000,validate:Number.isInteger}) entrevistas?: number;
  @Prop({type:String,trim:true}) vistoBueno?: string;
  @Prop({type:String,trim:true}) clasificacionCaso?: string;
  @Prop({type:Date}) fechaEntregaAnalisis?: Date;
  @Prop({type:String,trim:true}) observaciones?: string;
  @Prop({type:String,trim:true}) columnaAdicional?: string;
}
export const FichaConflictoSchema=SchemaFactory.createForClass(FichaConflicto);
