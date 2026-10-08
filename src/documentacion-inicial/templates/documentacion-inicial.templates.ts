/* =========================================================
   TIPOS
========================================================= */

export type TipoCasoDocumentacion =
  | 'Alerta'
  | 'Maltrato'
  | 'Conflicto';

export type ModalidadMaltrato =
  | 'OFICIO'
  | 'REQUERIMIENTO';

export type TipoRubrica =
  | 'ALERTA'
  | 'CONFLICTO'
  | 'MALTRATO_OFICIO'
  | 'MALTRATO_REQUERIMIENTO';


/* =========================================================
   PLAN DE INVESTIGACIÓN
========================================================= */

export interface PlanTemplateItem {
  codigo: string;
  elemento: string;
}

export interface PlanTemplate {
  tipoCaso: TipoCasoDocumentacion;
  titulo: string;
  elementos: PlanTemplateItem[];
}


/*
 * Formato específico para Alerta Alba-Keneth.
 */
export const PLAN_ALERTA: PlanTemplate = {

  tipoCaso: 'Alerta',

  titulo:
    'PLAN DE INVESTIGACIÓN (ALERTA ALBA KENETH)',

  elementos: [

    {
      codigo: 'DATOS_NNA',
      elemento:
        'DATOS GENERALES DEL NNA',
    },

    {
      codigo: 'CUANDO',
      elemento:
        'CUANDO (FECHA Y HORA DE LA DESAPARICIÓN)',
    },

    {
      codigo: 'DONDE',
      elemento:
        'DÓNDE (LUGAR DE LA DESAPARICIÓN)',
    },

    {
      codigo: 'POR_QUE',
      elemento:
        'POR QUÉ (PRESUNTO MÓVIL DE LA DESAPARICIÓN)',
    },

    {
      codigo: 'QUIEN_LO_TIENE',
      elemento:
        'QUIÉN LO TIENE (SOLO SI ES NNA SUSTRAÍDO)',
    },

  ],
};


/*
 * Formato general utilizado para investigación
 * de delitos.
 *
 * Aplica a:
 * - Maltrato
 * - Conflicto
 */
export const PLAN_GENERAL: PlanTemplate = {

  tipoCaso: 'Maltrato',

  titulo:
    'PLAN DE INVESTIGACIÓN',

  elementos: [

    {
      codigo: 'QUE',
      elemento:
        'QUÉ (HECHO OCURRIDO)',
    },

    {
      codigo: 'A_QUIEN',
      elemento:
        'A QUIÉN (VÍCTIMA)',
    },

    {
      codigo: 'QUIEN',
      elemento:
        'QUIÉN (VICTIMARIO)',
    },

    {
      codigo: 'COMO',
      elemento:
        'CÓMO (MODUS OPERANDI)',
    },

    {
      codigo: 'CUANDO',
      elemento:
        'CUANDO (FECHA Y HORA DEL HECHO)',
    },

    {
      codigo: 'DONDE',
      elemento:
        'DÓNDE (LUGAR DEL HECHO)',
    },

    {
      codigo: 'POR_QUE',
      elemento:
        'PORQUÉ (MÓVIL)',
    },

    {
      codigo: 'CON_QUE',
      elemento:
        'CON QUÉ (MEDIO)',
    },

  ],
};


/* =========================================================
   RÚBRICAS
========================================================= */

export type TipoItemRubrica =
  | 'ITEM'
  | 'SECCION';

export interface RubricaTemplateItem {

  codigo: string;

  descripcion: string;

  /*
   * ITEM:
   * El investigador debe marcar Sí o No.
   *
   * SECCION:
   * Solo representa un encabezado dentro del formato.
   */
  tipo: TipoItemRubrica;
}


export interface RubricaTemplate {

  tipo: TipoRubrica;

  titulo: string;

  preguntaProtocolo: string;

  items: RubricaTemplateItem[];
}


/* =========================================================
   RÚBRICA ALERTA ALBA-KENETH
========================================================= */

export const RUBRICA_ALERTA: RubricaTemplate = {

  tipo: 'ALERTA',

  titulo:
    'EVALUACIÓN DEL CUMPLIMIENTO DE PAP EN MATERIA DE INVESTIGACION EN CASOS DE NIÑAS, NIÑOS Y ADOLESCENTES DESAPARECIDOS Y/O SUSTRAÍDOS',

  preguntaProtocolo:
    'Tiene conocimiento de la existencia del Protocolo de Actuación Policial en Materia de Investigación en Casos de Niñas, Niños y Adolescentes Desaparecidos y/o Sustraídos',

  items: [

    {
      codigo: 'CARATULA',
      descripcion:
        'Cuenta con el llenado y carátula correspondiente la carpeta de investigación',
      tipo: 'ITEM',
    },

    {
      codigo: 'INFORME_6_HORAS',
      descripcion:
        'Integra informe de las primeras 6 horas por parte de Comisaría',
      tipo: 'ITEM',
    },

    {
      codigo: 'INFORME_PRELIMINAR_24_HORAS',
      descripcion:
        'Contiene informe preliminar (24 horas)',
      tipo: 'ITEM',
    },

    {
      codigo: 'RUTA_INVESTIGACION',
      descripcion:
        'Establece ruta de investigación',
      tipo: 'ITEM',
    },

    {
      codigo: 'PLAN_TRABAJO',
      descripcion:
        'Elabora plan de trabajo',
      tipo: 'ITEM',
    },

    {
      codigo: 'ENTREVISTAS',
      descripcion:
        'Contiene entrevistas a denunciante y testigos',
      tipo: 'ITEM',
    },

    {
      codigo: 'FOTOGRAFIAS_LUGAR',
      descripcion:
        'El informe contiene la documentación del lugar de los hechos (fotografías)',
      tipo: 'ITEM',
    },

    {
      codigo: 'CAMARAS',
      descripcion:
        'El informe contiene ubicación de cámaras de videovigilancia',
      tipo: 'ITEM',
    },

    {
      codigo: 'CROQUIS',
      descripcion:
        'Contiene croquis del lugar (Establece entradas y salidas del lugar)',
      tipo: 'ITEM',
    },

    {
      codigo: 'INDICADORES_AMBIENTALES',
      descripcion:
        'Establece indicadores ambientales',
      tipo: 'ITEM',
    },

    {
      codigo: 'PERFIL_VICTIMA',
      descripcion:
        'Perfila a la víctima',
      tipo: 'ITEM',
    },

    {
      codigo: 'PERFIL_SINDICADO',
      descripcion:
        'Perfila al sindicado',
      tipo: 'ITEM',
    },

    {
      codigo: 'ORDEN_CONDUCCION',
      descripcion:
        'Contiene orden de conducción',
      tipo: 'ITEM',
    },

    {
      codigo: 'ORDEN_INGRESO_CENTRO',
      descripcion:
        'Contiene Orden de Ingreso en Centros de detención juvenil',
      tipo: 'ITEM',
    },


    /* -----------------------------------------
       LOCALIZACIÓN EN PRIMERAS 24 HORAS
    ----------------------------------------- */

    {
      codigo: 'SECCION_LOCALIZADO_24H',
      descripcion:
        '¿Sí el NNA es localizado en las primeras 24 horas?',
      tipo: 'SECCION',
    },

    {
      codigo: 'INFORME_LOCALIZACION_24H',
      descripcion:
        'Elabora informe de localización',
      tipo: 'ITEM',
    },

    {
      codigo: 'DESACTIVACION_ALERTA_24H',
      descripcion:
        'Contiene copia de la desactivación de la Alerta Alba-Keneth',
      tipo: 'ITEM',
    },

    {
      codigo: 'INFORME_FINAL_24H',
      descripcion:
        'Elabora informe final de investigación',
      tipo: 'ITEM',
    },


    /* -----------------------------------------
       PASADAS 24 HORAS
    ----------------------------------------- */

    {
      codigo: 'SECCION_DESPUES_24H',
      descripcion:
        'Actuaciones pasadas las 24 horas sin localizar al NNA',
      tipo: 'SECCION',
    },

    {
      codigo: 'AMPLIACION_SEGUIMIENTO',
      descripcion:
        'Contiene informe de ampliación de seguimiento',
      tipo: 'ITEM',
    },

    {
      codigo: 'INTERPOL',
      descripcion:
        'Coordina con INTERPOL (individualizar a posibles sindicados)',
      tipo: 'ITEM',
    },

    {
      codigo: 'APREHENSION_ALLANAMIENTOS',
      descripcion:
        'Contiene ordenes de aprehensión o allanamientos',
      tipo: 'ITEM',
    },

    {
      codigo: 'INACIF',
      descripcion:
        'Se constituye al Instituto Nacional de Ciencias Forenses para establecer de NNA',
      tipo: 'ITEM',
    },


    /* -----------------------------------------
       LOCALIZACIÓN POSTERIOR
    ----------------------------------------- */

    {
      codigo: 'SECCION_LOCALIZADO',
      descripcion:
        '¿Sí el NNA es localizado?',
      tipo: 'SECCION',
    },

    {
      codigo: 'INFORME_LOCALIZACION',
      descripcion:
        'Elabora informe de localización',
      tipo: 'ITEM',
    },

    {
      codigo: 'DESACTIVACION_ALERTA',
      descripcion:
        'Contiene copia de la desactivación de la Alerta Alba-Keneth',
      tipo: 'ITEM',
    },

    {
      codigo: 'INFORME_FINAL',
      descripcion:
        'Elabora informe final de investigación',
      tipo: 'ITEM',
    },

    {
      codigo: 'INFORMES_AMPLIACION',
      descripcion:
        'Contiene informes de ampliación',
      tipo: 'ITEM',
    },

    {
      codigo: 'VISTO_BUENO',
      descripcion:
        'Contiene el visto bueno del jefe inmediato o encargado',
      tipo: 'ITEM',
    },

  ],
};


/* =========================================================
   RÚBRICA CONFLICTO
========================================================= */

export const RUBRICA_CONFLICTO: RubricaTemplate = {

  tipo: 'CONFLICTO',

  titulo:
    'EVALUACIÓN DEL CUMPLIMIENTO DE PAP EN MATERIA DE INVESTIGACION EN CASOS DE ADOLESCENTES EN CONFLICTO CON LA LEY PENAL',

  preguntaProtocolo:
    'Tiene conocimiento de la existencia del Protocolo de Actuación Policial en Materia de Investigación en Casos de Adolescentes en Conflicto con la Ley Penal',

  items: [

    {
      codigo: 'CARATULA',
      descripcion:
        'Cuenta con el llenado y carátula correspondiente la carpeta de investigación',
      tipo: 'ITEM',
    },

    {
      codigo: 'PLAN_INVESTIGACION',
      descripcion:
        'Contine el Plan de Investigación',
      tipo: 'ITEM',
    },

    {
      codigo: 'REQUERIMIENTO_MP',
      descripcion:
        'Contine conocimiento de oficio y/o requerimiento de investigación del Ministerio Público',
      tipo: 'ITEM',
    },

    {
      codigo: 'INFORME_PRELIMINAR',
      descripcion:
        'Realiza informe preliminar (24 horas)',
      tipo: 'ITEM',
    },

    {
      codigo: 'FOTOGRAFIAS_LUGAR',
      descripcion:
        'El informe contiene la documentación del lugar de los hechos (fotografías)',
      tipo: 'ITEM',
    },

    {
      codigo: 'DOCUMENTA_FOTOGRAFIAS',
      descripcion:
        'Documenta a través de fotografías',
      tipo: 'ITEM',
    },

    {
      codigo: 'CROQUIS',
      descripcion:
        'Contiene croquis del lugar',
      tipo: 'ITEM',
    },

    {
      codigo: 'ENTREVISTAS_TESTIGOS',
      descripcion:
        'Realiza entrevistas a testigos',
      tipo: 'ITEM',
    },

    {
      codigo: 'CAMARAS',
      descripcion:
        'El informe contiene ubicación de cámaras de videovigilancia',
      tipo: 'ITEM',
    },

    {
      codigo: 'FACTORES_RIESGO',
      descripcion:
        'Establece factores de riesgo',
      tipo: 'ITEM',
    },

    {
      codigo: 'ENTREVISTA_VICTIMA',
      descripcion:
        'Realiza entrevista a la victima',
      tipo: 'ITEM',
    },

    {
      codigo: 'SOLICITUDES_INFORMACION',
      descripcion:
        'Contiene solicitudes de información a otras dependencias',
      tipo: 'ITEM',
    },

    {
      codigo: 'FICHA_INDIVIDUALIZACION',
      descripcion:
        'Elabora la ficha personal de individualización del adolescente',
      tipo: 'ITEM',
    },

    {
      codigo: 'INDIVIDUALIZA_TESTIGOS',
      descripcion:
        'Individualiza testigos y/o sujetos de interés',
      tipo: 'ITEM',
    },

    {
      codigo: 'INFORME_72_HORAS',
      descripcion:
        'Contiene informe de (72 horas)',
      tipo: 'ITEM',
    },

    {
      codigo: 'SOLICITUD_ALLANAMIENTO',
      descripcion:
        'Contiene solicitud de orden de allanamiento, inspección y registro',
      tipo: 'ITEM',
    },

    {
      codigo: 'INFORME_ALLANAMIENTO',
      descripcion:
        'Integra informe de ejecución de allanamiento',
      tipo: 'ITEM',
    },

    {
      codigo: 'ORDEN_CONDUCCION',
      descripcion:
        'Contiene solicitud de órdenes de conducción',
      tipo: 'ITEM',
    },

    {
      codigo: 'APREHENSIONES',
      descripcion:
        'Integra aprehensiones ejecutadas (prevención policial)',
      tipo: 'ITEM',
    },

    {
      codigo: 'DILIGENCIAS_JUDICIALES',
      descripcion:
        'Integra solicitudes de diligencias judiciales',
      tipo: 'ITEM',
    },

    {
      codigo: 'VISTO_BUENO',
      descripcion:
        'Contiene el visto bueno del jefe inmediato o encargado',
      tipo: 'ITEM',
    },

  ],
};


/* =========================================================
   MALTRATO A REQUERIMIENTO DEL MP
========================================================= */

export const RUBRICA_MALTRATO_REQUERIMIENTO:
RubricaTemplate = {

  tipo: 'MALTRATO_REQUERIMIENTO',

  titulo:
    'EVALUACIÓN DEL CUMPLIMIENTO DE PAP EN MATERIA DE INV. CRIMINAL EN CASOS DE NIÑAS, NIÑOS Y ADOLESCENTES VICTIMAS DE MALTRATO A REQUERIMIENTO DE MP',

  preguntaProtocolo:
    'Tiene conocimiento de la existencia del Protocolo de Actuación Policial en Materia de Investigación Criminal en casos de Niñas, Niños y Adolescentes Víctimas de Maltrato a Requerimiento de Ministerio Público',

  items: [

    {
      codigo: 'CARATULA',
      descripcion:
        'Cuenta con el llenado y carátula correspondiente la carpeta de investigación',
      tipo: 'ITEM',
    },

    {
      codigo: 'REQUERIMIENTO_MP',
      descripcion:
        'Integra requerimiento del Ministerio Público o denuncia',
      tipo: 'ITEM',
    },

    {
      codigo: 'PLAN_INVESTIGACION',
      descripcion:
        'Establece plan de investigación',
      tipo: 'ITEM',
    },

    {
      codigo: 'INFORME_INVESTIGACION',
      descripcion:
        'Contiene informe de investigación correspondiente',
      tipo: 'ITEM',
    },

    {
      codigo: 'FOTOGRAFIAS',
      descripcion:
        'El informe contiene la documentación del lugar de los hechos (fotografías)',
      tipo: 'ITEM',
    },

    {
      codigo: 'CAMARAS',
      descripcion:
        'El informe contiene ubicación de cámaras de videovigilancia',
      tipo: 'ITEM',
    },

    {
      codigo: 'INDICADORES_MALTRATO',
      descripcion:
        'Establece indicadores ambientales de maltrato',
      tipo: 'ITEM',
    },

    {
      codigo: 'CROQUIS',
      descripcion:
        'Contiene croquis del lugar',
      tipo: 'ITEM',
    },

    {
      codigo: 'ENTREVISTAS',
      descripcion:
        'Contiene entrevistas a denunciante y testigos',
      tipo: 'ITEM',
    },

    {
      codigo: 'PERFIL_VICTIMA',
      descripcion:
        'Perfila a la víctima',
      tipo: 'ITEM',
    },

    {
      codigo: 'PERFIL_SINDICADO',
      descripcion:
        'Perfil al sindicado',
      tipo: 'ITEM',
    },

    {
      codigo: 'ORDEN_APREHENSION',
      descripcion:
        'Contiene ordenes de aprehensión',
      tipo: 'ITEM',
    },

    {
      codigo: 'APREHENSIONES',
      descripcion:
        'Integra aprehensiones ejecutadas',
      tipo: 'ITEM',
    },

    {
      codigo: 'SOLICITUD_ALLANAMIENTO',
      descripcion:
        'Realizó solicitudes de allanamientos',
      tipo: 'ITEM',
    },

    {
      codigo: 'INFORME_ALLANAMIENTO',
      descripcion:
        'Integra informe de allanamientos ejecutados',
      tipo: 'ITEM',
    },

    {
      codigo: 'INTERVENCION_CAUTELAR',
      descripcion:
        'Integra Informe de intervención cautelar',
      tipo: 'ITEM',
    },

    {
      codigo: 'SOLICITUDES_INFORMACION',
      descripcion:
        'Contiene las solicitudes de información a otras dependencias',
      tipo: 'ITEM',
    },

    {
      codigo: 'AMPLIACIONES',
      descripcion:
        'Contiene informes de ampliación',
      tipo: 'ITEM',
    },

    {
      codigo: 'VISTO_BUENO',
      descripcion:
        'Contiene el visto bueno del jefe inmediato o encargado',
      tipo: 'ITEM',
    },

  ],
};


/* =========================================================
   MALTRATO DE OFICIO
========================================================= */

export const RUBRICA_MALTRATO_OFICIO:
RubricaTemplate = {

  tipo: 'MALTRATO_OFICIO',

  titulo:
    'EVALUACIÓN DEL CUMPLIMIENTO DE PAP EN MATERIA DE INV. CRIMINAL EN CASOS DE NIÑAS, NIÑOS Y ADOLESCENTES VICTIMAS DE MALTRATO, DE OFICIO',

  preguntaProtocolo:
    'Tiene conocimiento de la existencia del Protocolo de Actuación Policial en Materia de Investigación Criminal en casos de Niñas, Niños y Adolescentes Víctimas de Maltrato, de Oficio',

  items: [

    {
      codigo: 'CARATULA',
      descripcion:
        'Cuenta con el llenado y carátula correspondiente la carpeta de investigación',
      tipo: 'ITEM',
    },

    {
      codigo: 'DENUNCIA',
      descripcion:
        'Integra requerimiento denuncia (exceptuando MP)',
      tipo: 'ITEM',
    },

    {
      codigo: 'PLAN_INVESTIGACION',
      descripcion:
        'Establece plan de investigación',
      tipo: 'ITEM',
    },

    {
      codigo: 'INFORME_INVESTIGACION',
      descripcion:
        'Contiene informe de investigación correspondiente',
      tipo: 'ITEM',
    },

    {
      codigo: 'FOTOGRAFIAS',
      descripcion:
        'El informe contiene la documentación del lugar de los hechos (fotografías)',
      tipo: 'ITEM',
    },

    {
      codigo: 'CAMARAS',
      descripcion:
        'El informe contiene ubicación de cámaras de videovigilancia',
      tipo: 'ITEM',
    },

    {
      codigo: 'INDICADORES_MALTRATO',
      descripcion:
        'Establece indicadores ambientales de maltrato',
      tipo: 'ITEM',
    },

    {
      codigo: 'CROQUIS',
      descripcion:
        'Contiene croquis del lugar (Establece entradas y salidas del lugar)',
      tipo: 'ITEM',
    },

    {
      codigo: 'ENTREVISTAS',
      descripcion:
        'Contiene entrevistas a denunciante y testigos',
      tipo: 'ITEM',
    },

    {
      codigo: 'PERFIL_VICTIMA',
      descripcion:
        'Perfila a la víctima',
      tipo: 'ITEM',
    },

    {
      codigo: 'PERFIL_SINDICADO',
      descripcion:
        'Perfil al sindicado',
      tipo: 'ITEM',
    },

    {
      codigo: 'ORDEN_APREHENSION',
      descripcion:
        'Contiene ordenes de aprehensión',
      tipo: 'ITEM',
    },

    {
      codigo: 'APREHENSIONES',
      descripcion:
        'Integra aprehensiones ejecutadas',
      tipo: 'ITEM',
    },

    {
      codigo: 'SOLICITUD_ALLANAMIENTO',
      descripcion:
        'Realizó solicitudes de allanamientos',
      tipo: 'ITEM',
    },

    {
      codigo: 'INFORME_ALLANAMIENTO',
      descripcion:
        'Integra informe de allanamientos ejecutados',
      tipo: 'ITEM',
    },

    {
      codigo: 'INTERVENCION_CAUTELAR',
      descripcion:
        'Integra Informe de intervención cautelar',
      tipo: 'ITEM',
    },

    {
      codigo: 'SOLICITUDES_INFORMACION',
      descripcion:
        'Contiene las solicitudes de información a otras dependencias',
      tipo: 'ITEM',
    },

    {
      codigo: 'AMPLIACIONES',
      descripcion:
        'Contiene informes de ampliación',
      tipo: 'ITEM',
    },

    {
      codigo: 'VISTO_BUENO',
      descripcion:
        'Contiene el visto bueno del jefe inmediato o encargado',
      tipo: 'ITEM',
    },

  ],
};


/* =========================================================
   FUNCIONES PARA OBTENER LAS PLANTILLAS
========================================================= */

export function getPlanTemplate(
  tipoCaso: TipoCasoDocumentacion,
): PlanTemplate {

  if (tipoCaso === 'Alerta') {
    return PLAN_ALERTA;
  }


  /*
   * Maltrato y Conflicto utilizan
   * el plan general.
   */
  return {
    ...PLAN_GENERAL,
    tipoCaso,
  };
}


export function getRubricaTemplate(
  tipoCaso: TipoCasoDocumentacion,
  modalidadMaltrato?: ModalidadMaltrato,
): RubricaTemplate {

  if (tipoCaso === 'Alerta') {

    return RUBRICA_ALERTA;

  }


  if (tipoCaso === 'Conflicto') {

    return RUBRICA_CONFLICTO;

  }


  if (!modalidadMaltrato) {

    throw new Error(
      'Debe indicar la modalidad del caso de Maltrato.',
    );
  }


  return modalidadMaltrato === 'OFICIO'
    ? RUBRICA_MALTRATO_OFICIO
    : RUBRICA_MALTRATO_REQUERIMIENTO;
}