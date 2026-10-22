import { Schema, Types } from 'mongoose';

export enum OrigenCaso { SISTEMA = 'SISTEMA', HISTORICO = 'HISTORICO' }
export enum EstadoExpedienteHistorico {
  COMPLETO = 'COMPLETO', PARCIAL = 'PARCIAL', NO_LOCALIZADO = 'NO_LOCALIZADO',
}
export enum FuenteInformacionHistorica {
  EXPEDIENTE_FISICO = 'EXPEDIENTE_FISICO', COPIA_ANALISIS = 'COPIA_ANALISIS',
  REGISTRO_EXCEL = 'REGISTRO_EXCEL', NUEVO_REQUERIMIENTO = 'NUEVO_REQUERIMIENTO', OTRO = 'OTRO',
}

export interface MetadatosCasoHistorico {
  origenCaso: OrigenCaso;
  estadoExpedienteHistorico?: EstadoExpedienteHistorico;
  fechaIncorporacionSistema?: Date;
  investigadorOriginal?: { usuarioId?: Types.ObjectId; nombre?: string };
  fuenteInformacionHistorica?: FuenteInformacionHistorica;
  observacionHistorica?: string;
  anioCaso?: number;
}

// ownerDocument permite conservar las exigencias de personas/lugares en casos normales.
// Indica si el documento pertenece al flujo normal para aplicar campos obligatorios que se
// relajan en expedientes históricos.
function requeridoEnSistema(this: any): boolean {
  const caso = typeof this.ownerDocument === 'function' ? this.ownerDocument() : this;
  return caso.origenCaso !== OrigenCaso.HISTORICO;
}

// Añade metadatos de procedencia e investigador original al esquema y adapta sus campos
// obligatorios para permitir expedientes históricos incompletos.
export function configurarCasoHistorico(schema: Schema, camposFlexibles: string[]) {
  schema.add({
    origenCaso: { type: String, enum: Object.values(OrigenCaso), default: OrigenCaso.SISTEMA },
    estadoExpedienteHistorico: {
      type: String, enum: Object.values(EstadoExpedienteHistorico),
      required: function () { return this.origenCaso === OrigenCaso.HISTORICO; },
    },
    fechaIncorporacionSistema: { type: Date },
    investigadorOriginal: {
      type: new Schema({
        usuarioId: { type: Schema.Types.ObjectId, ref: 'Usuario' },
        nombre: { type: String, trim: true },
      }, { _id: false }),
    },
    fuenteInformacionHistorica: { type: String, enum: Object.values(FuenteInformacionHistorica) },
    observacionHistorica: { type: String, trim: true },
    anioCaso: { type: Number, min: 1, max: 9999, validate: Number.isInteger },
  });
  // Mongoose admite una función; sus tipos de SchemaType.required solo declaran boolean.
  for (const campo of camposFlexibles) (schema.path(campo) as any).required(requeridoEnSistema);
  for (const campo of ['infractores', 'victimas', 'lugarHechos']) {
    const hijo = (schema.path(campo) as any)?.schema as Schema | undefined;
    hijo?.eachPath((_nombre, path: any) => {
      if (path.isRequired) path.required(requeridoEnSistema);
    });
  }
}
