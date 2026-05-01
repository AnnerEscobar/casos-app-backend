import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type InformeDocument = Informe & Document;

@Schema({ timestamps: true })
export class Informe {

  @Prop({ required: true, unique: true })
  numeroDeic: string;

  @Prop({ required: true })
  numeroMp: string;

  @Prop({ required: true, enum: ['alerta', 'maltrato', 'conflicto'] })
  tipoInforme: string;

  @Prop({ default: 'borrador', enum: ['borrador', 'pendiente_registro', 'registrado'] })
  estado: string;

  // Sección 1 - Datos generales
  @Prop({ type: Object, default: {} })
  datosGenerales: {
    fechaInforme?: string;
    nombreFiscal?: string;
    fechaRequerimiento?: string;
    descripcionInicial?: string;
    hipotesis?: string;
    fechaDiligencias?: string;
    nombreAcompanante?: string;
    vehiculo?: string;
  };

  // Sección 2 - Perfil víctima
  @Prop({ type: Object, default: {} })
  perfilVictima: {
    nombre?: string;
    alias?: string;
    edad?: string;
    fechaNacimiento?: string;
    nacionalidad?: string;
    caracteristicasFisicas?: string;
    lugarTrabajo?: string;
    escolaridad?: string;
    centroEducativo?: string;
    nombrePadres?: string;
    residencia?: string;
    telefono?: string;
    parentescoSindicado?: string;
    antecedentesProteccion?: string;
    antecedentesAlerta?: string;
    indicadoresMaltrato?: string;
    hermanosmenores?: string;
    otraInfo?: string;
    fotoUrl?: string;
  };

  // Sección 3 - Perfil sindicado/denunciante/adolescente (varía por tipo)
  @Prop({ type: Object, default: {} })
  perfilSecundario: {
    nombre?: string;
    alias?: string;
    edad?: string;
    fechaNacimiento?: string;
    estadoCivil?: string;
    profesion?: string;
    lugarTrabajo?: string;
    documentoIdentificacion?: string;
    nacionalidad?: string;
    caracteristicasFisicas?: string;
    nombrePadres?: string;
    residencia?: string;
    telefono?: string;
    referencias?: string;
    parentescoVictima?: string;
    antecedentesPolicia?: string;
    otraInfo?: string;
    // Campos específicos adolescente ACLP
    cui?: string;
    pertenenciaEtnica?: string;
    discapacidad?: string;
    identidadGenero?: string;
    redesSociales?: string;
    antecedentesProteccion?: string;
    antecedentesAlerta?: string;
    consumoDrogas?: string;
    ingresoCentroPrivacion?: string;
    parientesPrivados?: string;
    flujoMigratorio?: string;
    pandillas?: string;
    parientesPandillas?: string;
    fotoUrl?: string;
  };

  // Sección 4 - Entrevistas
  @Prop({ type: Object, default: {} })
  entrevistas: {
    padresEncargados?: string;
    denuncianteTestigos?: string;
    vecinos?: string;
    victima?: string;
  };

  // Sección 5 - Perfilación del lugar
  @Prop({ type: Object, default: {} })
  perfilacionLugar: {
    descripcion?: string;
    camaras?: string;
    indicadoresAmbientales?: string;
    accesasSalidas?: string;
  };

  // Sección 6 - Diligencias específicas (varía por tipo)
  @Prop({ type: Object, default: {} })
  diligencias: {
    centrosAsistenciales?: string;
    juzgados?: string;
    centrosMedicos?: string;
    bomberos?: string;
    hogaresProteccion?: string;
    inacif?: string;
    centrosDetencion?: string;
    comunicacionPnc?: string;
    oficio110?: string;
    oficioDelegaciones?: string;
    oficioDireccionMigracion?: string;
    oficioInterpol?: string;
    otrasDiligencias?: string;
    busquedaInmediata?: string;
    // ACLP específico
    solicitudOrdenConduccion?: string;
    solicitudAllanamiento?: string;
    metodosEspeciales?: string;
    exhibicionesPersonales?: string;
  };

  // Sección 7 - Conclusiones y observaciones
  @Prop({ type: Object, default: {} })
  conclusiones: {
    conclusiones?: string;
    observaciones?: string;
    anexos?: string;
  };

  // Secciones completadas (para saber cuáles ya llenó)
  @Prop({ type: [String], default: [] })
  seccionesCompletadas: string[];

  // Ampliaciones
  @Prop({ type: Array, default: [] })
  ampliaciones: {
    fecha: Date;
    descripcion: string;
    fileUrl?: string;
  }[];

  // Archivo word generado
  @Prop({ required: false })
  wordUrl?: string;

  // Archivo PDF final con sellos
  @Prop({ required: false })
  pdfFinalUrl?: string;
}

export const InformeSchema = SchemaFactory.createForClass(Informe);