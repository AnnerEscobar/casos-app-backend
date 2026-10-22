import { textosMayusculasPlugin } from '../../common/textos-mayusculas';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocumentacionInicialDocument =
  DocumentacionInicial & Document;

/* ======================================================
   CARÁTULA
====================================================== */

@Schema({ _id: false })
export class DatosCaratula {

  @Prop()
  numeroDeic?: string;

  @Prop()
  numeroMp?: string;

  @Prop()
  numeroAlerta?: string;

  @Prop()
  nombre?: string;

  @Prop()
  edad?: string;

  @Prop()
  fechaNac?: Date;

  @Prop()
  lugar?: string;

  @Prop()
  departamento?: string;

  @Prop()
  municipio?: string;

  @Prop()
  observaciones?: string;
}

export const DatosCaratulaSchema =
  SchemaFactory.createForClass(DatosCaratula);


/* ======================================================
   PLAN DE INVESTIGACIÓN
====================================================== */

@Schema({ _id: false })
export class ElementoPlan {

  @Prop({ required: true })
  codigo: string;

  @Prop({ required: true })
  elemento: string;

  @Prop()
  informacionObtenida?: string;

  @Prop()
  informacionNecesitaObtener?: string;

  @Prop()
  diligenciasRealizar?: string;
}

export const ElementoPlanSchema =
  SchemaFactory.createForClass(ElementoPlan);


@Schema({ _id: false })
export class PlanInvestigacion {
  @Prop() mandoNombre?: string;

  @Prop({ type: [ElementoPlanSchema], default: [] })
  elementos: ElementoPlan[];

  @Prop()
  observaciones?: string;
}

export const PlanInvestigacionSchema =
  SchemaFactory.createForClass(PlanInvestigacion);


/* ======================================================
   RÚBRICA
====================================================== */

@Schema({ _id: false })
export class RespuestaRubrica {

  @Prop({ required: true })
  codigo: string;

  @Prop({ required: true })
  descripcion: string;

  @Prop({
    enum: ['SI', 'NO', 'NO_APLICA'],
  })
  respuesta?: 'SI' | 'NO' | 'NO_APLICA';

  @Prop()
  observaciones?: string;
}

export const RespuestaRubricaSchema =
  SchemaFactory.createForClass(RespuestaRubrica);


@Schema({ _id: false })
export class Rubrica {
  @Prop() dependenciaSupervisada?: string;
  @Prop() supervisorNombre?: string;

  @Prop({
    enum: [
      'ALERTA',
      'CONFLICTO',
      'MALTRATO_OFICIO',
      'MALTRATO_REQUERIMIENTO',
    ],
  })
  tipo?: string;

  @Prop({
    enum: ['SI', 'NO'],
  })
  conoceProtocolo?: 'SI' | 'NO';

  @Prop({
    type: [RespuestaRubricaSchema],
    default: [],
  })
  respuestas: RespuestaRubrica[];
}

export const RubricaSchema =
  SchemaFactory.createForClass(Rubrica);


/* ======================================================
   PDF FINAL
====================================================== */

@Schema({ _id: false })
export class DocumentoFinal {

  @Prop()
  nombreArchivo?: string;

  @Prop()
  driveFileId?: string;

  @Prop()
  url?: string;

  @Prop()
  fechaGeneracion?: Date;
}

export const DocumentoFinalSchema =
  SchemaFactory.createForClass(DocumentoFinal);


/* ======================================================
   DOCUMENTACIÓN INICIAL
====================================================== */

@Schema({ timestamps: true })
export class DocumentacionInicial {

  @Prop({
    required: true,
    enum: ['Alerta', 'Maltrato', 'Conflicto'],
  })
  tipoCaso: 'Alerta' | 'Maltrato' | 'Conflicto';


  /*
   * Solo aplica a Maltrato.
   * Define qué rúbrica utilizar.
   */
  @Prop({
    enum: ['OFICIO', 'REQUERIMIENTO'],
  })
  modalidadMaltrato?: 'OFICIO' | 'REQUERIMIENTO';


  /*
   * El DEIC puede no existir mientras el investigador
   * todavía está trabajando el primer paso.
   */
  @Prop({
    unique: true,
    sparse: true,
    trim: true,
  })
  numeroDeic?: string;


  /*
   * Investigador propietario del pre-registro.
   * Este valor NO debería venir libremente del frontend.
   * Lo obtendremos del JWT.
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Usuario',
    required: true,
  })
  investigadorId: Types.ObjectId;


  /*
   * Guardamos también el nombre como fotografía histórica.
   * Si mañana cambia el nombre del usuario, sabemos quién
   * aparecía originalmente en estos documentos.
   */
  @Prop({ required: true })
  investigadorNombre: string;


  @Prop({
    enum: [
      'BORRADOR',
      'PENDIENTE_REGISTRO',
      'EN_REVISION',
      'RECHAZADO',
      'REGISTRADO',
    ],
    default: 'BORRADOR',
  })
  estado:
    | 'BORRADOR'
    | 'PENDIENTE_REGISTRO'
    | 'EN_REVISION'
    | 'RECHAZADO'
    | 'REGISTRADO';


  @Prop({
    min: 1,
    max: 3,
    default: 1,
  })
  pasoActual: number;


  /* =======================
     PASO 1
  ======================= */

  @Prop({
    type: DatosCaratulaSchema,
    default: {},
  })
  caratula: DatosCaratula;


  /* =======================
     PASO 2
  ======================= */

  @Prop({
    type: PlanInvestigacionSchema,
    default: {},
  })
  planInvestigacion: PlanInvestigacion;


  /* =======================
     PASO 3
  ======================= */

  @Prop({
    type: RubricaSchema,
    default: {},
  })
  rubrica: Rubrica;


  /* =======================
     PDF DEFINITIVO
  ======================= */

  @Prop({
    type: DocumentoFinalSchema,
  })
  documentoFinal?: DocumentoFinal;


  /*
   * Se llena cuando el caso ya pasa por el registro
   * formal y posteriormente es aprobado.
   */
  @Prop()
  casoId?: string;
}


export const DocumentacionInicialSchema =
  SchemaFactory.createForClass(DocumentacionInicial);
DocumentacionInicialSchema.plugin(textosMayusculasPlugin);
