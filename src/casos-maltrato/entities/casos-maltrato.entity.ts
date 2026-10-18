import { configurarCasoHistorico, MetadatosCasoHistorico } from '../../common/historicos/caso-historico.schema';
import { FichaMaltrato, FichaMaltratoSchema } from './ficha-maltrato.schema';
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


export type CasosMaltratoDocument =
  CasosMaltrato & Document;


/* =========================================================
   HISTORIAL DE REVISIÓN
========================================================= */

@Schema({
  _id: false
})
export class RevisionRegistro {

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

export const RevisionRegistroSchema =
  SchemaFactory.createForClass(
    RevisionRegistro
  );


/* =========================================================
   PERSONA MALTRATO
   Se utiliza tanto para sindicados como para víctimas.
========================================================= */

@Schema({
  _id: false
})
export class PersonaMaltrato {
  @Prop({type:Number,min:0,max:130,validate:Number.isInteger}) edadReportada?: number;
  @Prop() departamento?: string;
  @Prop() municipio?: string;
  @Prop() zona?: string;
  @Prop() etnia?: string;
  @Prop() sexo?: string;
  @Prop() nacionalidad?: string;
  @Prop() ocupacion?: string;
  @Prop() parentesco?: string;
  @Prop() denuncianteNombre?: string;
  @Prop() denuncianteTelefono?: string;
  @Prop() denuncianteParentesco?: string;

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

export const PersonaMaltratoSchema =
  SchemaFactory.createForClass(
    PersonaMaltrato
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
   SEGUIMIENTO
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
   ESQUEMA PRINCIPAL
========================================================= */

@Schema({
  timestamps: true
})
export class CasosMaltrato extends Document {
  @Prop({default:false}) procesoMaltrato?: boolean;
  @Prop({default:false}) expedienteEnPreparacion?: boolean;
  @Prop({type:Types.ObjectId,ref:'Usuario'}) investigadorAsignado?: Types.ObjectId;
  @Prop({type:Date}) fechaIngreso?: Date;
  @Prop({type:Date}) fechaEnvioRevision?: Date;
  @Prop({type:FichaMaltratoSchema,default:()=>({})}) fichaMaltrato?: FichaMaltrato;


  /* =========================
     IDENTIFICADORES
  ========================== */

  @Prop({
    required: true,
    match:
      /^(?:DEIC51-\d{4}-\d{2}-\d{2}-\d+|MT\d{6})$/,
  })
  numeroDeic: string;


  @Prop({
    required: true,
    match: [
      /^(?:(?:MPE01|M0008|MP004|M0030|MP001)-\d{4}-\d+|IC\/PNCORLLAT\d+-\d{4}-\d+)$/,
      'El numeroMp debe seguir uno de estos formatos: ' +
      'MPE01-AAAA-NNNN, ' +
      'M0008-AAAA-NNNN, ' +
      'IC/PNCORLLATXXX-AAAA-NNNN, ' +
      'MP004-AAAA-NNNN, ' +
      'M0030-AAAA-NNNN o ' +
      'MP001-AAAA-NNNN'
    ],
  })
  numeroMp: string;


  /* =========================
     ESTADO INVESTIGACIÓN
  ========================== */

  @Prop({
    required: true
  })
  estadoInvestigacion: string;


  /* =========================
     AUTORIZACIÓN DE REGISTRO
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
      RevisionRegistroSchema
    ],
    default: [],
  })
  historialRevisiones:
    RevisionRegistro[];


  /* =========================
     PERSONAS
  ========================== */

  /*
   * Mongo conserva el nombre
   * histórico "infractores"
   *
   * En V3 frontend/DTO se usa:
   * "sindicados"
   *
   * El service hace:
   *
   * sindicados -> infractores
   */

  @Prop({
    type: [
      PersonaMaltratoSchema
    ],
    required: true,
    default: []
  })
  infractores:
    PersonaMaltrato[];


  @Prop({
    type: [
      PersonaMaltratoSchema
    ],
    required: true,
    default: []
  })
  victimas:
    PersonaMaltrato[];


  /* =========================
     LUGAR DE LOS HECHOS
  ========================== */

  /*
   * required:false para mantener
   * compatibilidad con registros
   * históricos V2.
   *
   * El DTO V3 sí lo exige.
   */

  @Prop({
    type:
      LugarHechosSchema,
    required: false,
    default: null
  })
  lugarHechos?:
    LugarHechos | null;


  /* =========================
     DOCUMENTOS
  ========================== */

  /*
   * Aquí se guardan únicamente
   * URLs de Google Drive.
   */

  @Prop({
    type: [String],
    default: []
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

export const CasosMaltratoSchema =
  SchemaFactory.createForClass(
    CasosMaltrato
  );
export interface CasosMaltrato extends MetadatosCasoHistorico {}
configurarCasoHistorico(CasosMaltratoSchema, ["numeroMp","estadoInvestigacion"]);
// Reemplazar las reglas previas evita duplicar validadores required en Mongoose.
for(const campo of ['numeroMp','estadoInvestigacion']) {
  const path=CasosMaltratoSchema.path(campo) as any;
  path.validators=path.validators.filter((v:any)=>v.type!=='required');
  path.required(function(){return this.origenCaso!=='HISTORICO' && !this.procesoMaltrato;});
}
for(const campo of ['victimas','infractores','lugarHechos']) {
  const hijo=(CasosMaltratoSchema.path(campo) as any).schema;
  hijo.eachPath((_key:string,path:any)=>{
    if(!path.isRequired)return;
    path.validators=path.validators.filter((v:any)=>v.type!=='required');
    path.required(function(){const caso=this.ownerDocument();return caso.origenCaso!=='HISTORICO' && !caso.procesoMaltrato;});
  });
}
CasosMaltratoSchema.set('optimisticConcurrency',true);
CasosMaltratoSchema.index({ numeroDeic: 1 }, { unique: true, partialFilterExpression: { numeroDeic: { $type: 'string' } } });
