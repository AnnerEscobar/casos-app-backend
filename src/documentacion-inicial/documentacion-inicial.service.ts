import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  getPlanTemplate,
  getRubricaTemplate,
} from './templates/documentacion-inicial.templates';

import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  DocumentacionInicial,
  DocumentacionInicialDocument,
  DatosCaratula,
  PlanInvestigacion,
  Rubrica,
  DocumentoFinal,
} from './entities/documentacion-inicial.entity';

import { CreateDocumentacionInicialDto } from './dto/create-documentacion-inicial.dto';

import {
  assertValidCaratulaMpNumber,
  assertValidCaseNumber,
  caratulaTipoToCaseNumberTipo,
} from 'src/common/case-number.validator';

import { UpdatePlanInvestigacionDto } from './dto/update-plan-investigacion.dto';
import { UpdateRubricaDto } from './dto/update-rubrica.dto';
import { UpdateCaratulaDocumentacionDto } from './dto/update-caratula-documentacion.dto';


@Injectable()
export class DocumentacionInicialService {

  constructor(
    @InjectModel(DocumentacionInicial.name)
    private readonly documentacionModel: Model<DocumentacionInicialDocument>,
  ) {}


  /* ======================================================
   OBTENER PLANTILLA / DATOS DEL PLAN
====================================================== */

async getPlanPaso(
  id: string,
  investigadorId: string,
) {

  const documentacion =
    await this.findOne(
      id,
      investigadorId,
    );


  const plantilla =
    getPlanTemplate(
      documentacion.tipoCaso,
    );


  const elementosGuardados =
    documentacion.planInvestigacion
      ?.elementos ?? [];


  return {

    documentacionId:
      documentacion._id,

    numeroDeic:
      documentacion.numeroDeic,

    tipoCaso:
      documentacion.tipoCaso,

    titulo:
      plantilla.titulo,

    elementos:
      plantilla.elementos.map(
        (elemento) => {

          const guardado =
            elementosGuardados.find(
              (item) =>
                item.codigo ===
                elemento.codigo,
            );


          return {

            codigo:
              elemento.codigo,

            elemento:
              elemento.elemento,

            informacionObtenida:
              guardado
                ?.informacionObtenida
              ?? '',

            informacionNecesitaObtener:
              guardado
                ?.informacionNecesitaObtener
              ?? '',

            diligenciasRealizar:
              guardado
                ?.diligenciasRealizar
              ?? '',

          };
        },
      ),

    observaciones:
      documentacion
        .planInvestigacion
        ?.observaciones
      ?? '',

  };
}


/* ======================================================
   OBTENER PLANTILLA / DATOS DE RÚBRICA
====================================================== */

async getRubricaPaso(
  id: string,
  investigadorId: string,
) {

  const documentacion =
    await this.findOne(
      id,
      investigadorId,
    );


  let plantilla;

  try {

    plantilla =
      getRubricaTemplate(
        documentacion.tipoCaso,
        documentacion.modalidadMaltrato,
      );

  } catch (error) {

    throw new BadRequestException(
      error instanceof Error
        ? error.message
        : 'No se pudo determinar la rúbrica.',
    );
  }


  const respuestasGuardadas =
    documentacion.rubrica
      ?.respuestas ?? [];


  return {

    documentacionId:
      documentacion._id,

    numeroDeic:
      documentacion.numeroDeic,

    tipoCaso:
      documentacion.tipoCaso,

    modalidadMaltrato:
      documentacion.modalidadMaltrato,

    tipoRubrica:
      plantilla.tipo,

    titulo:
      plantilla.titulo,

    preguntaProtocolo:
      plantilla.preguntaProtocolo,

    conoceProtocolo:
      documentacion.rubrica
        ?.conoceProtocolo
      ?? null,

    items:
      plantilla.items.map(
        (item) => {

          const respuesta =
            respuestasGuardadas.find(
              (r) =>
                r.codigo ===
                item.codigo,
            );


          return {

            codigo:
              item.codigo,

            descripcion:
              item.descripcion,

            tipo:
              item.tipo,

            respuesta:
              item.tipo === 'ITEM'
                ? respuesta
                    ?.respuesta
                  ?? null
                : null,

            observaciones:
              item.tipo === 'ITEM'
                ? respuesta
                    ?.observaciones
                  ?? ''
                : '',

          };
        },
      ),

  };
}


  /* ======================================================
     PASO 1
     CREAR DOCUMENTACIÓN INICIAL / BORRADOR
  ====================================================== */

  async create(
    dto: CreateDocumentacionInicialDto,
    investigadorId: string,
    investigadorNombre: string,
  ): Promise<DocumentacionInicial> {

    if (!Types.ObjectId.isValid(investigadorId)) {
      throw new BadRequestException(
        'El identificador del investigador no es válido.',
      );
    }

    /*
     * Validamos y normalizamos el número DEIC.
     */
    const numeroDeic = assertValidCaseNumber(
      caratulaTipoToCaseNumberTipo(dto.tipoCaso),
      dto.numeroDeic,
    );


    /*
     * Validamos MP.
     */
    const numeroMp = assertValidCaratulaMpNumber(
      dto.tipoCaso,
      dto.caratula.numeroMp,
    );


    /*
     * Verificamos que ese DEIC no haya sido utilizado
     * anteriormente en documentación inicial.
     */
    const existe = await this.documentacionModel.findOne({
      numeroDeic,
    });

    if (existe) {
      throw new ConflictException(
        `Ya existe documentación inicial para el número DEIC ${numeroDeic}.`,
      );
    }


    /*
     * Normalizamos los textos introducidos por
     * el investigador.
     */
    const caratula = this.normalizeCaratula({
      ...dto.caratula,
      numeroMp,
    });


    try {

      const documentacion = await this.documentacionModel.create({

        tipoCaso: dto.tipoCaso,

        modalidadMaltrato:
          dto.tipoCaso === 'Maltrato'
            ? dto.modalidadMaltrato
            : undefined,

        numeroDeic,

        investigadorId: new Types.ObjectId(investigadorId),

        investigadorNombre:
          this.toTitleCase(investigadorNombre),

        estado: 'BORRADOR',

        pasoActual: 1,

        caratula,

        planInvestigacion: {
          elementos: [],
          observaciones: '',
        },

        rubrica: {
          respuestas: [],
        },

      });


      return documentacion;

    } catch (error: any) {

      /*
       * Protección adicional en caso de índice unique
       * de MongoDB.
       */
      if (error?.code === 11000) {
        throw new ConflictException(
          `Ya existe documentación inicial para el número DEIC ${numeroDeic}.`,
        );
      }

      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      console.error(
        '❌ Error al crear documentación inicial:',
        error,
      );

      throw new BadRequestException(
        'No se pudo crear la documentación inicial.',
      );
    }
  }


  /* ======================================================
     OBTENER MIS DOCUMENTOS
  ====================================================== */

  async findMine(
    investigadorId: string,
  ): Promise<DocumentacionInicial[]> {

    return this.documentacionModel
      .find({
        investigadorId: new Types.ObjectId(investigadorId),
      })
      .sort({
        updatedAt: -1,
      })
      .exec();
  }


  /* ======================================================
     PENDIENTES DEL INVESTIGADOR
  ====================================================== */

  async findMisPendientesPaginated(
    investigadorId: string,
    skip: number,
    limit: number,
  ): Promise<DocumentacionInicial[]> {

    return this.documentacionModel
      .find({
        investigadorId: new Types.ObjectId(investigadorId),

        estado: {
          $in: [
            'BORRADOR',
            'PENDIENTE_REGISTRO',
            'RECHAZADO',
          ],
        },
      })
      .sort({
        updatedAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .exec();
  }


  async countMisPendientes(
    investigadorId: string,
  ): Promise<number> {

    return this.documentacionModel.countDocuments({

      investigadorId: new Types.ObjectId(investigadorId),

      estado: {
        $in: [
          'BORRADOR',
          'PENDIENTE_REGISTRO',
          'RECHAZADO',
        ],
      },

    });
  }


  /* ======================================================
     HISTORIAL
  ====================================================== */

  async findMiHistorial(
    investigadorId: string,
  ): Promise<DocumentacionInicial[]> {

    return this.documentacionModel
      .find({
        investigadorId: new Types.ObjectId(investigadorId),

        estado: {
          $in: [
            'EN_REVISION',
            'REGISTRADO',
          ],
        },
      })
      .sort({
        updatedAt: -1,
      })
      .exec();
  }


  /* ======================================================
     OBTENER UNA DOCUMENTACIÓN
  ====================================================== */

  async findOne(
    id: string,
    investigadorId: string,
  ): Promise<DocumentacionInicialDocument> {

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(
        'Identificador de documentación no válido.',
      );
    }

    const documentacion = await this.documentacionModel.findOne({

      _id: id,

      investigadorId:
        new Types.ObjectId(investigadorId),

    });


    if (!documentacion) {
      throw new NotFoundException(
        'No se encontró la documentación inicial.',
      );
    }


    return documentacion;
  }


  /* ======================================================
     ACTUALIZAR PASO 1
     CARÁTULA
  ====================================================== */

async updateCaratula(
  id: string,
  investigadorId: string,
  data: {
    numeroDeic?: string;

    modalidadMaltrato?:
      | 'OFICIO'
      | 'REQUERIMIENTO';

    caratula?: Partial<DatosCaratula>;
  },
) : Promise<DocumentacionInicial> {

    const documentacion =
      await this.findOne(id, investigadorId);


    this.assertEditable(documentacion);


    /*
     * Si cambia el DEIC, volvemos a validarlo.
     */
    if (data.numeroDeic) {

      const numeroDeic = assertValidCaseNumber(
        caratulaTipoToCaseNumberTipo(
          documentacion.tipoCaso,
        ),
        data.numeroDeic,
      );


      const existe =
        await this.documentacionModel.findOne({

          _id: {
            $ne: documentacion._id,
          },

          numeroDeic,

        });


      if (existe) {
        throw new ConflictException(
          `Ya existe documentación inicial para ${numeroDeic}.`,
        );
      }


      documentacion.numeroDeic = numeroDeic;
    }


    /*
     * Modalidad solamente aplica a Maltrato.
     */
    if (
      documentacion.tipoCaso === 'Maltrato' &&
      data.modalidadMaltrato
    ) {

      documentacion.modalidadMaltrato =
        data.modalidadMaltrato;
    }


   if (data.caratula) {

  const documentacionPlana =
    documentacion.toObject();

  const nuevosDatos = {
    ...(documentacionPlana.caratula ?? {}),
    ...data.caratula,
  };


  /*
   * Si cambia MP, volver a validarlo.
   */
  if (
    data.caratula.numeroMp !== undefined
  ) {

    nuevosDatos.numeroMp =
      assertValidCaratulaMpNumber(
        documentacion.tipoCaso,
        data.caratula.numeroMp,
      );
  }


  /*
   * Número de Alerta solamente aplica
   * para casos de Alerta.
   */
  if (
    documentacion.tipoCaso !== 'Alerta' &&
    data.caratula.numeroAlerta
  ) {

    throw new BadRequestException(
      'El número de Alerta solamente aplica a casos de Alerta Alba-Keneth.',
    );
  }


  documentacion.caratula =
    this.normalizeCaratula(
      nuevosDatos as DatosCaratula,
    );
}


    return documentacion.save();
  }


  /* ======================================================
     PASO 2
     PLAN DE INVESTIGACIÓN
  ====================================================== */
async updatePlan(
  id: string,
  investigadorId: string,
  plan: UpdatePlanInvestigacionDto,
): Promise<DocumentacionInicial> {

  const documentacion =
    await this.findOne(
      id,
      investigadorId,
    );


  this.assertEditable(
    documentacion,
  );


  const plantilla =
    getPlanTemplate(
      documentacion.tipoCaso,
    );


  /*
   * Códigos permitidos para este tipo de caso.
   */
  const elementosPermitidos =
    new Map(
      plantilla.elementos.map(
        (elemento) => [
          elemento.codigo,
          elemento,
        ],
      ),
    );


  /*
   * Validamos que Angular no envíe elementos
   * que no pertenecen al formato.
   */
  for (
    const elemento of plan.elementos
  ) {

    if (
      !elementosPermitidos.has(
        elemento.codigo,
      )
    ) {

      throw new BadRequestException(
        `El elemento ${elemento.codigo} no pertenece al plan de investigación de ${documentacion.tipoCaso}.`,
      );
    }
  }


  /*
   * Construimos el plan utilizando SIEMPRE
   * los textos oficiales del backend.
   */
  documentacion.planInvestigacion = {

    elementos:
      plantilla.elementos.map(
        (plantillaElemento) => {

          const respuesta =
            plan.elementos.find(
              (item) =>
                item.codigo ===
                plantillaElemento.codigo,
            );


          return {

            codigo:
              plantillaElemento.codigo,

            elemento:
              plantillaElemento.elemento,

            informacionObtenida:
              respuesta
                ?.informacionObtenida
              ?? '',

            informacionNecesitaObtener:
              respuesta
                ?.informacionNecesitaObtener
              ?? '',

            diligenciasRealizar:
              respuesta
                ?.diligenciasRealizar
              ?? '',

          };
        },
      ),

    observaciones:
      plan.observaciones ?? '',

  };


  documentacion.pasoActual =
    Math.max(
      documentacion.pasoActual ?? 1,
      2,
    );


  return documentacion.save();
}


  /* ======================================================
     PASO 3
     RÚBRICA
  ====================================================== */

async updateRubrica(
  id: string,
  investigadorId: string,
  dto: UpdateRubricaDto,
): Promise<DocumentacionInicial> {

  const documentacion =
    await this.findOne(
      id,
      investigadorId,
    );


  this.assertEditable(
    documentacion,
  );


  /*
   * Obtenemos automáticamente la rúbrica
   * correspondiente.
   */
  let plantilla;

  try {

    plantilla =
      getRubricaTemplate(
        documentacion.tipoCaso,
        documentacion.modalidadMaltrato,
      );

  } catch (error) {

    throw new BadRequestException(
      error instanceof Error
        ? error.message
        : 'No se pudo determinar la rúbrica.',
    );
  }


  /*
   * Solo los ITEM reciben respuesta.
   * Las SECCION son títulos internos del formato.
   */
  const itemsRespondibles =
    plantilla.items.filter(
      (item) =>
        item.tipo === 'ITEM',
    );


  const itemsPermitidos =
    new Map(
      itemsRespondibles.map(
        (item) => [
          item.codigo,
          item,
        ],
      ),
    );


  /*
   * Validar códigos enviados.
   */
  for (
    const respuesta of dto.respuestas
  ) {

    if (
      !itemsPermitidos.has(
        respuesta.codigo,
      )
    ) {

      throw new BadRequestException(
        `El elemento ${respuesta.codigo} no pertenece a esta rúbrica.`,
      );
    }
  }


  /*
   * Generamos las respuestas utilizando
   * las descripciones oficiales.
   */
  documentacion.rubrica = {

    tipo:
      plantilla.tipo,

    conoceProtocolo:
      dto.conoceProtocolo,

    respuestas:
      itemsRespondibles.map(
        (itemPlantilla) => {

          const respuesta =
            dto.respuestas.find(
              (item) =>
                item.codigo ===
                itemPlantilla.codigo,
            );


          /*
           * Todavía permitimos que un borrador
           * no tenga todas las respuestas.
           *
           * Antes de generar PDF validaremos
           * que estén todas completas.
           */
          return {

            codigo:
              itemPlantilla.codigo,

            descripcion:
              itemPlantilla.descripcion,

            respuesta:
              respuesta?.respuesta,

            observaciones:
              respuesta
                ?.observaciones
              ?? '',

          };

        },
      ),

  };


  documentacion.pasoActual = 3;


  return documentacion.save();
}


  /* ======================================================
     GUARDAR PDF FINAL
  ====================================================== */

  async saveDocumentoFinal(
    id: string,
    investigadorId: string,
    documento: DocumentoFinal,
  ): Promise<DocumentacionInicial> {

    const documentacion =
      await this.findOne(id, investigadorId);


    this.assertEditable(documentacion);


    /*
     * Antes de finalizar comprobamos que estén
     * completados Plan y Rúbrica.
     */

    if (
      !documentacion.planInvestigacion?.elementos ||
      documentacion.planInvestigacion.elementos.length === 0
    ) {

      throw new BadRequestException(
        'Debe completar el plan de investigación.',
      );
    }


    if (
      !documentacion.rubrica?.respuestas ||
      documentacion.rubrica.respuestas.length === 0
    ) {

      throw new BadRequestException(
        'Debe completar la rúbrica.',
      );
    }


    documentacion.documentoFinal = {

      ...documento,

      fechaGeneracion: new Date(),

    };


    /*
     * Solamente después de generar correctamente
     * el documento completo deja de ser borrador.
     */
    documentacion.estado =
      'PENDIENTE_REGISTRO';

    documentacion.pasoActual = 3;


    return documentacion.save();
  }


  /* ======================================================
     CUANDO EL INVESTIGADOR REGISTRA EL CASO
  ====================================================== */

  async marcarEnRevision(
    id: string,
    investigadorId: string,
    casoId: string,
  ): Promise<DocumentacionInicial> {

    const documentacion =
      await this.findOne(id, investigadorId);


    if (
      documentacion.estado !==
      'PENDIENTE_REGISTRO'
    ) {

      throw new BadRequestException(
        'La documentación no está pendiente de registro.',
      );
    }


    documentacion.estado = 'EN_REVISION';

    documentacion.casoId = casoId;


    return documentacion.save();
  }


  /* ======================================================
     REGISTRO RECHAZADO
  ====================================================== */

  async marcarRechazado(
    id: string,
  ): Promise<DocumentacionInicial> {

    const documentacion =
      await this.documentacionModel.findById(id);


    if (!documentacion) {

      throw new NotFoundException(
        'No se encontró la documentación inicial.',
      );
    }


    documentacion.estado = 'RECHAZADO';


    return documentacion.save();
  }


  /* ======================================================
     REGISTRO APROBADO
  ====================================================== */

  async marcarRegistrado(
    id: string,
    casoId: string,
  ): Promise<DocumentacionInicial> {

    const documentacion =
      await this.documentacionModel.findById(id);


    if (!documentacion) {

      throw new NotFoundException(
        'No se encontró la documentación inicial.',
      );
    }


    documentacion.estado = 'REGISTRADO';

    documentacion.casoId = casoId;


    return documentacion.save();
  }


  /* ======================================================
     ELIMINAR BORRADOR
  ====================================================== */

  async removeDraft(
    id: string,
    investigadorId: string,
  ): Promise<void> {

    const documentacion =
      await this.findOne(id, investigadorId);


    if (documentacion.estado !== 'BORRADOR') {

      throw new BadRequestException(
        'Solo pueden eliminarse documentos en estado borrador.',
      );
    }


    await this.documentacionModel.deleteOne({
      _id: documentacion._id,
    });
  }


  /* ======================================================
     VALIDAR SI PUEDE EDITARSE
  ====================================================== */

  private assertEditable(
    documentacion: DocumentacionInicialDocument,
  ): void {

    if (
      documentacion.estado === 'REGISTRADO' ||
      documentacion.estado === 'EN_REVISION'
    ) {

      throw new BadRequestException(
        'Esta documentación ya no puede modificarse.',
      );
    }
  }


  /* ======================================================
     NORMALIZAR CARÁTULA
  ====================================================== */

  private normalizeCaratula(
    data: Partial<DatosCaratula>,
  ): DatosCaratula {

    const normalized: any = {
      ...data,
    };


    if (data.nombre) {
      normalized.nombre =
        this.toTitleCase(data.nombre);
    }


    if (data.lugar) {
      normalized.lugar =
        this.toTitleCase(data.lugar);
    }


    if (data.departamento) {
      normalized.departamento =
        this.toTitleCase(data.departamento);
    }


    if (data.municipio) {
      normalized.municipio =
        this.toTitleCase(data.municipio);
    }


    if (data.observaciones) {
      normalized.observaciones =
        this.toSentenceCase(
          data.observaciones,
        );
    }


    if (data.edad) {

      normalized.edad =
        data.edad
          .trim()
          .replace(/\s+/g, ' ');

    }


    return normalized as DatosCaratula;
  }


  /* ======================================================
     TITLE CASE
  ====================================================== */

  private toTitleCase(
    value?: string,
  ): string {

    if (!value) {
      return '';
    }


    const lowerCaseWords =
      new Set([
        'a',
        'al',
        'de',
        'del',
        'la',
        'las',
        'los',
        'el',
        'y',
        'o',
      ]);


    return value
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('es-GT')
      .split(' ')
      .map(
        (
          word,
          index,
        ) => {

          if (
            index > 0 &&
            lowerCaseWords.has(word)
          ) {
            return word;
          }


          return word
            .split('-')
            .map(
              (part) =>
                this.capitalizeWord(part),
            )
            .join('-');
        },
      )
      .join(' ');
  }


  /* ======================================================
     SENTENCE CASE
  ====================================================== */

  private toSentenceCase(
    value?: string,
  ): string {

    if (!value) {
      return '';
    }


    const normalized =
      value
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('es-GT');


    return this.capitalizeWord(
      normalized,
    );
  }


  /* ======================================================
     CAPITALIZAR
  ====================================================== */

  private capitalizeWord(
    value: string,
  ): string {

    if (!value) {
      return value;
    }


    return (
      value
        .charAt(0)
        .toLocaleUpperCase('es-GT') +
      value.slice(1)
    );
  }
}