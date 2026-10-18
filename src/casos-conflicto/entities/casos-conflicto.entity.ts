import { FichaConflicto, FichaConflictoSchema } from './ficha-conflicto.schema';
import { configurarCasoHistorico, MetadatosCasoHistorico } from '../../common/historicos/caso-historico.schema';
import {
  Prop,
  Schema,
  SchemaFactory
} from '@nestjs/mongoose';

import {
  Document,
  Types
} from 'mongoose';

import {
  EstadoRegistro
} from '../../common/enums/estado-registro.enum';

import {
  TipoRevisionRegistro
} from '../../common/enums/tipo-revision-registro.enum';


export type CasosConflictoDocument =
  CasosConflicto & Document;


/* =========================================================
   INFRACTORES Y VÍCTIMAS
========================================================= */

@Schema({
  _id: false
})
export class VictimaInfractor {
  @Prop({type:Number,min:0,max:130,validate:Number.isInteger}) edadReportada?: number;
  @Prop() sexo?: string;
  @Prop() alias?: string;
  @Prop() ocupacion?: string;
  @Prop() nombrePadre?: string;
  @Prop() nombreMadre?: string;
  @Prop() estadoFisico?: string;
  @Prop() telefono?: string;
  @Prop() tipoPersona?: string;


  @Prop({
    required: true
  })
  nombre: string;


  @Prop({
    required: true
  })
  cui: string;


  @Prop({
    required: true
  })
  fecha_Nac: Date;


  @Prop({
    required: true
  })
  direccion: string;

}


export const VictimaInfractorSchema =
  SchemaFactory.createForClass(
    VictimaInfractor
  );


/* =========================================================
   LUGAR DE LOS HECHOS
========================================================= */

@Schema({
  _id: false
})
export class LugarHechos {

  @Prop({
    required: true
  })
  departamento: string;


  @Prop({
    required: true
  })
  municipio: string;


  @Prop({
    required: true
  })
  direccionDetallada: string;

}


export const LugarHechosSchema =
  SchemaFactory.createForClass(
    LugarHechos
  );


/* =========================================================
   SEGUIMIENTOS
========================================================= */

@Schema({
  _id: false,
  timestamps: true
})
export class Seguimiento {
  @Prop({ type: Types.ObjectId, ref: 'Usuario' })
  registradoPor?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Usuario' })
  investigadorAsignado?: Types.ObjectId;


  @Prop({
    default: Date.now
  })
  fecha: Date;


  @Prop({
    required: true
  })
  estado: string;


  @Prop({
    type: [String],
    default: []
  })
  archivos: string[];

}


export const SeguimientoSchema =
  SchemaFactory.createForClass(
    Seguimiento
  );


/* =========================================================
   HISTORIAL DE AUTORIZACIÓN
========================================================= */

@Schema({
  _id: false
})
export class RevisionRegistroConflicto {

  @Prop({
    type: String,
    enum: Object.values(
      TipoRevisionRegistro
    ),
    required: true,
  })
  tipo: TipoRevisionRegistro;


  @Prop({
    type: Types.ObjectId,
    ref: 'Usuario',
    required: true,
  })
  usuario: Types.ObjectId;


  @Prop({
    type: Date,
    default: Date.now,
  })
  fecha: Date;


  @Prop({
    type: String,
    trim: true,
    default: null,
  })
  observacion?: string | null;


  @Prop({
    type: String,
    default: null,
  })
  archivoUrl?: string | null;

}


export const RevisionRegistroConflictoSchema =
  SchemaFactory.createForClass(
    RevisionRegistroConflicto
  );


/* =========================================================
   ESQUEMA PRINCIPAL
========================================================= */

@Schema({
  timestamps: true
})
export class CasosConflicto extends Document {
  @Prop({default:false}) procesoConflicto?: boolean;
  @Prop({default:false}) expedienteEnPreparacion?: boolean;
  @Prop({type:Types.ObjectId,ref:'Usuario'}) investigadorAsignado?: Types.ObjectId;
  @Prop({type:Date}) fechaIngreso?: Date;
  @Prop({type:Date}) fechaEnvioRevision?: Date;
  @Prop({type:FichaConflictoSchema,default:()=>({})}) fichaConflicto?: FichaConflicto;





  /* =========================
     IDENTIFICADORES
  ========================== */

  @Prop({
    required: true,
    match:
      /^(?:DEIC53-\d{4}-\d{2}-\d{2}-\d+|AC\d{6})$/,
  })
  numeroDeic: string;


  @Prop({
    required: true,
    match:
      /^(?:M0004|MP001|MPE01)-\d{4}-\d+$/,
  })
  numeroMp: string;


  /* =========================
     ESTADO DE INVESTIGACIÓN
  ========================== */

  @Prop({
    required: true
  })
  estadoInvestigacion: string;


  /* =========================
     CONTROL DE REGISTRO
     Y AUTORIZACIÓN
  ========================== */

  @Prop({
    type: String,
    enum: Object.values(
      EstadoRegistro
    ),
    default:
      EstadoRegistro.APROBADO,
    required: true,
  })
  estadoRegistro:
    EstadoRegistro;


  @Prop({
    type: Types.ObjectId,
    ref: 'Usuario',
    default: null,
  })
  registradoPor?:
    Types.ObjectId | null;


  @Prop({
    type: Types.ObjectId,
    ref: 'Usuario',
    default: null,
  })
  revisadoPor?:
    Types.ObjectId | null;


  @Prop({
    type: Date,
    default: null,
  })
  fechaRevision?:
    Date | null;


  @Prop({
    type: String,
    default: null,
    trim: true,
  })
  motivoRechazo?:
    string | null;


  @Prop({
    type: [
      RevisionRegistroConflictoSchema
    ],
    default: [],
  })
  historialRevisiones:
    RevisionRegistroConflicto[];


  /* =========================
     INFRACTORES
  ========================== */

  @Prop({
    type: [
      VictimaInfractorSchema
    ],
    required: true,
    default: []
  })
  infractores:
    VictimaInfractor[];


  /* =========================
     VÍCTIMAS
  ========================== */

  @Prop({
    type: [
      VictimaInfractorSchema
    ],
    required: true,
    default: []
  })
  victimas:
    VictimaInfractor[];


  /* =========================
     LUGAR DE LOS HECHOS
  ========================== */

  /*
   * Obligatorio en DTO V3.
   *
   * Opcional en Mongo porque los
   * casos históricos V2 pueden
   * no contener este campo.
   */

  @Prop({
    type: LugarHechosSchema,
    required: false,
    default: null,
  })
  lugarHechos?:
    LugarHechos | null;


  /* =========================
     DOCUMENTOS
  ========================== */

  /*
   * Se almacenan únicamente
   * las URLs de Google Drive.
   */

  @Prop({
    type: [String],
    default: [],
  })
  fileUrls:
    string[];


  /* =========================
     SEGUIMIENTOS
  ========================== */

  @Prop({
    type: [
      SeguimientoSchema
    ],
    default: []
  })
  seguimientos:
    Seguimiento[];

}


/* =========================================================
   SCHEMA PRINCIPAL
========================================================= */

export const CasosConflictoSchema =
  SchemaFactory.createForClass(
    CasosConflicto
  );
export interface CasosConflicto extends MetadatosCasoHistorico {}
configurarCasoHistorico(CasosConflictoSchema, ["numeroMp","estadoInvestigacion"]);
// Reemplazar las reglas previas evita duplicar validadores required en Mongoose.
for(const campo of ['numeroMp','estadoInvestigacion']) {
  const path=CasosConflictoSchema.path(campo) as any;
  path.validators=path.validators.filter((v:any)=>v.type!=='required');
  path.required(function(){return this.origenCaso!=='HISTORICO' && !this.procesoConflicto;});
}
for(const campo of ['victimas','infractores','lugarHechos']) {
  const hijo=(CasosConflictoSchema.path(campo) as any).schema;
  hijo.eachPath((_key:string,path:any)=>{
    if(!path.isRequired)return;
    path.validators=path.validators.filter((v:any)=>v.type!=='required');
    path.required(function(){const caso=this.ownerDocument();return caso.origenCaso!=='HISTORICO' && !caso.procesoConflicto;});
  });
}
CasosConflictoSchema.set('optimisticConcurrency',true);
CasosConflictoSchema.index({ numeroDeic: 1 }, { unique: true, partialFilterExpression: { numeroDeic: { $type: 'string' } } });
