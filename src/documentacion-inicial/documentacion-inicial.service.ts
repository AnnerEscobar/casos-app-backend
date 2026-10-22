import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { generarDocumentacionPdf } from './documentacion-pdf';


@Injectable()
export class DocumentacionInicialService {

  // Recibe el modelo de documentación inicial y su conexión para consultar también el caso
  // vinculado.
  constructor(
    @InjectModel(DocumentacionInicial.name)
    private readonly documentacionModel: Model<DocumentacionInicialDocument>,
  ) {}

  // Valida el tipo e ID del caso y comprueba que el investigador de la sesión sea el asignado,
  // comparando el valor de sus identificadores.
  private async casoAsignado(tipo: string, casoId: string, investigadorId: string) {
    const modelos = { Alerta: 'CasosAlerta', Maltrato: 'CasosMaltrato', Conflicto: 'CasosConflicto' };
    if (!modelos[tipo] || !Types.ObjectId.isValid(casoId)) throw new BadRequestException('El caso indicado no es válido.');
    const caso = await this.documentacionModel.db.model(modelos[tipo]).findById(casoId).populate('investigadorAsignado', 'nombre');
    if (!caso) throw new NotFoundException('No se encontró el caso asignado.');
    if (!Types.ObjectId.isValid(investigadorId) || String(caso.investigadorAsignado?._id || caso.investigadorAsignado) !== String(investigadorId)) {
      throw new ForbiddenException('Solo el investigador asignado puede preparar estos documentos.');
    }
    return caso;
  }

  // Recupera el expediente y su borrador compatible, precarga los datos disponibles y determina
  // si la etapa actual permite editar los documentos.
  async paraCaso(tipo: string, casoId: string, investigadorId: string) {
    const caso = await this.casoAsignado(tipo, casoId, investigadorId);
    const documentacion = await this.documentacionModel.findOne({ numeroDeic: caso.numeroDeic });
    if (documentacion && (String(documentacion.investigadorId) !== String(investigadorId) || documentacion.tipoCaso !== tipo ||
      (documentacion.casoId && documentacion.casoId !== casoId))) {
      throw new ConflictException('El DEIC ya tiene documentación de otro expediente o investigador.');
    }
    const personas = tipo === 'Alerta' ? [{ nombre: caso.nombreDesaparecido, fecha_Nac: caso.fecha_Nac, edadReportada: caso.fichaAlerta?.edadReportada }]
      : tipo === 'Maltrato' ? caso.victimas || [] : caso.infractores || [];
    // Conserva una edad reportada o calcula la edad a la fecha de ingreso cuando existen ambas
    // fechas, sin inventar datos desconocidos.
    const edad = (persona: any) => {
      if (persona.edadReportada != null) return String(persona.edadReportada);
      if (!persona.fecha_Nac || !caso.fechaIngreso) return '';
      const nac = new Date(persona.fecha_Nac), ingreso = new Date(caso.fechaIngreso);
      if (Number.isNaN(nac.getTime()) || Number.isNaN(ingreso.getTime())) return '';
      const valor = ingreso.getUTCFullYear() - nac.getUTCFullYear() - Number(ingreso.getUTCMonth() < nac.getUTCMonth() || (ingreso.getUTCMonth() === nac.getUTCMonth() && ingreso.getUTCDate() < nac.getUTCDate()));
      return valor < 0 ? '' : String(valor);
    };
    const lugar = tipo === 'Alerta' ? caso.direccion : caso.lugarHechos;
    return {
      casoId, tipoCaso: tipo, numeroDeic: caso.numeroDeic,
      editable: !!caso.expedienteEnPreparacion || caso.estadoRegistro === 'Rechazado',
      caratula: {
        numeroMp: caso.numeroMp || '', numeroAlerta: caso.numeroAlerta || '',
        nombre: personas.map((p: any) => p.nombre).filter(Boolean).join('; '),
        edad: personas.length === 1 ? edad(personas[0]) : personas.map((p: any) => `${p.nombre || 'Sin nombre'}: ${edad(p) || 'Sin indicar'}`).join('; '),
        lugar: lugar?.direccionDetallada || '', departamento: lugar?.departamento || '', municipio: lugar?.municipio || '',
      },
      documentacion,
    };
  }

  // Exige una carátula válida, un plan completo y las respuestas de la rúbrica antes de generar
  // el PDF imprimible sin entregar el caso.
  async generarPdf(id: string, investigadorId: string) {
    const doc = await this.findOne(id, investigadorId);
    // Consultar e imprimir no constituye una entrega ni modifica su estado.
    const plan = this.planDocumento(doc), rubrica = this.rubricaDocumento(doc);
    if (!doc.caratula?.nombre?.trim() || !doc.caratula?.lugar?.trim()) throw new BadRequestException('Complete nombre y lugar de la carátula antes de imprimir.');
    assertValidCaratulaMpNumber(doc.tipoCaso, doc.caratula.numeroMp);
    if (doc.tipoCaso === 'Alerta' && !/^\d+-\d{4}$/.test(doc.caratula.numeroAlerta || '')) throw new BadRequestException('Complete el número de alerta antes de imprimir.');
    if (!plan.elementos.length || plan.elementos.some(e => ![e.informacionObtenida, e.informacionNecesitaObtener, e.diligenciasRealizar].some(v => v?.trim()))) {
      throw new BadRequestException('Complete cada elemento del plan; indique No aplica cuando corresponda.');
    }
    if (!['SI', 'NO'].includes(rubrica.conoceProtocolo) || rubrica.items.some(i => i.tipo === 'ITEM' && !['SI', 'NO'].includes(i.respuesta))) {
      throw new BadRequestException('Guarde las respuestas de todos los elementos y del protocolo de la rúbrica antes de imprimir.');
    }
    return { buffer: await generarDocumentacionPdf(doc, plan, rubrica), numeroDeic: doc.numeroDeic };
  }


  /* ======================================================
   OBTENER PLANTILLA / DATOS DEL PLAN
====================================================== */

// Comprueba el acceso a la documentación y devuelve el plan preparado con su plantilla y datos
// guardados.
async getPlanPaso(
  id: string,
  investigadorId: string,
) {

  const documentacion =
    await this.findOne(
      id,
      investigadorId,
    );

  return this.planDocumento(documentacion);
}

// Combina los elementos de la plantilla del tipo de caso con la información ya guardada,
// identificándolos por su código.
private planDocumento(documentacion: DocumentacionInicialDocument) {


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

    mandoNombre: documentacion.planInvestigacion?.mandoNombre || '',

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

// Comprueba el acceso a la documentación y devuelve la rúbrica con su plantilla y respuestas
// guardadas.
async getRubricaPaso(
  id: string,
  investigadorId: string,
) {

  const documentacion =
    await this.findOne(
      id,
      investigadorId,
    );

  return this.rubricaDocumento(documentacion);
}

// Selecciona la rúbrica por tipo y modalidad y completa sus ítems con las respuestas
// existentes sin alterar la plantilla.
private rubricaDocumento(documentacion: DocumentacionInicialDocument) {


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

    dependenciaSupervisada: documentacion.rubrica?.dependenciaSupervisada || '',
    supervisorNombre: documentacion.rubrica?.supervisorNombre || '',

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

  // Valida identificadores y asignación, evita documentación duplicada y crea un borrador
  // inicial vinculado al caso cuando corresponde.
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
    // También vincular entradas desde el módulo general cuando el caso ya
    // existe; omitir casoId no permite eludir la asignación ni el bloqueo.
    if (!dto.casoId) {
      const modelos = { Alerta: 'CasosAlerta', Maltrato: 'CasosMaltrato', Conflicto: 'CasosConflicto' };
      const existente = await this.documentacionModel.db.model(modelos[dto.tipoCaso]).findOne({ numeroDeic });
      if (existente) dto = { ...dto, casoId: String(existente._id) };
    }


    /*
     * Validamos MP.
     */
    const numeroMp = !dto.caratula.numeroMp?.trim() && dto.casoId ? undefined : assertValidCaratulaMpNumber(
      dto.tipoCaso,
      dto.caratula.numeroMp,
    );

    const caso = dto.casoId ? await this.casoAsignado(dto.tipoCaso, dto.casoId, investigadorId) : null;
    if (caso && (caso.numeroDeic !== numeroDeic || (!caso.expedienteEnPreparacion && caso.estadoRegistro !== 'Rechazado'))) {
      throw new ConflictException('El expediente no está disponible para preparar documentos.');
    }


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

        casoId: dto.casoId,

        investigadorId: new Types.ObjectId(investigadorId),

        investigadorNombre:
          this.toTitleCase(caso?.investigadorAsignado?.nombre || investigadorNombre),

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

  // Consulta todos los documentos del investigador y los ordena por su última modificación.
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

  // Devuelve una página de documentos del investigador en borrador, pendientes de registro o
  // rechazados, ordenados por actualización.
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


  // Cuenta los documentos pendientes del investigador usando los mismos estados del listado
  // paginado.
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

  // Consulta los documentos del investigador enviados a revisión o registrados y los ordena por
  // actualización.
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

  // Busca una documentación perteneciente al investigador y comprueba su acceso al expediente
  // asociado antes de devolverla.
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

    if (documentacion.casoId) {
      documentacion.$locals.casoAsociado = await this.casoAsignado(documentacion.tipoCaso, documentacion.casoId, investigadorId);
    } else {
      const modelos = { Alerta: 'CasosAlerta', Maltrato: 'CasosMaltrato', Conflicto: 'CasosConflicto' };
      const caso = await this.documentacionModel.db.model(modelos[documentacion.tipoCaso]).findOne({ numeroDeic: documentacion.numeroDeic });
      if (caso) documentacion.$locals.casoAsociado = await this.casoAsignado(documentacion.tipoCaso, String(caso._id), investigadorId);
    }


    return documentacion;
  }


  /* ======================================================
     ACTUALIZAR PASO 1
     CARÁTULA
  ====================================================== */

// Comprueba que el borrador sea editable, valida su vínculo con el expediente y actualiza la
// carátula sin permitir cambiar el DEIC vinculado.
async updateCaratula(
  id: string,
  investigadorId: string,
  data: {
    casoId?: string;
    numeroDeic?: string;

    modalidadMaltrato?:
      | 'OFICIO'
      | 'REQUERIMIENTO';

    caratula?: Partial<DatosCaratula>;
  },
) : Promise<DocumentacionInicial> {

    const documentacion =
      await this.findOne(id, investigadorId);


    await this.assertEditable(documentacion);
    if (data.casoId) {
      const caso = await this.casoAsignado(documentacion.tipoCaso, data.casoId, investigadorId);
      if (caso.numeroDeic !== documentacion.numeroDeic || (documentacion.casoId && documentacion.casoId !== data.casoId) ||
          (!caso.expedienteEnPreparacion && caso.estadoRegistro !== 'Rechazado')) throw new ConflictException('La documentación no corresponde a un expediente editable.');
      documentacion.casoId = data.casoId;
    }
    if ((documentacion.casoId || documentacion.$locals?.casoAsociado) && data.numeroDeic && data.numeroDeic !== documentacion.numeroDeic) throw new BadRequestException('No se puede cambiar el DEIC del caso vinculado.');


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


      if (!documentacion.casoId) {
        const modelos = { Alerta: 'CasosAlerta', Maltrato: 'CasosMaltrato', Conflicto: 'CasosConflicto' };
        const destino = await this.documentacionModel.db.model(modelos[documentacion.tipoCaso]).findOne({ numeroDeic });
        if (destino) {
          const caso = await this.casoAsignado(documentacion.tipoCaso, String(destino._id), investigadorId);
          if (!caso.expedienteEnPreparacion && caso.estadoRegistro !== 'Rechazado') throw new ConflictException('El expediente ya fue enviado al analista.');
          documentacion.casoId = String(caso._id);
        }
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

      if (documentacion.modalidadMaltrato !== data.modalidadMaltrato) documentacion.rubrica = { respuestas: [] };
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

    nuevosDatos.numeroMp = !data.caratula.numeroMp?.trim() && documentacion.casoId ? undefined :
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
// Valida los códigos contra la plantilla del caso y guarda los avances del plan únicamente si
// la documentación es editable.
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


  await this.assertEditable(
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
    mandoNombre: plan.mandoNombre || '',

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

// Valida respuestas y códigos de los ítems de la rúbrica correspondiente y guarda sus avances
// cuando se permite editar.
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


  await this.assertEditable(
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
    dependenciaSupervisada: dto.dependenciaSupervisada || '',
    supervisorNombre: dto.supervisorNombre || '',

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

  // Comprueba que existan plan y rúbrica antes de guardar los datos del documento final y
  // actualizar el avance del borrador.
  async saveDocumentoFinal(
    id: string,
    investigadorId: string,
    documento: DocumentoFinal,
  ): Promise<DocumentacionInicial> {

    const documentacion =
      await this.findOne(id, investigadorId);


    await this.assertEditable(documentacion);


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

  // Exige documentación pendiente de registro y la vincula al caso al pasarla a revisión.
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

  // Busca la documentación y la marca como rechazada para reflejar la decisión de revisión.
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

  // Busca la documentación, la marca como registrada y conserva la referencia del caso asociado.
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

  // Elimina únicamente documentación en borrador que pertenezca al investigador y siga siendo
  // editable según el caso vinculado.
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

    await this.assertEditable(documentacion);


    await this.documentacionModel.deleteOne({
      _id: documentacion._id,
    });
  }


  /* ======================================================
     VALIDAR SI PUEDE EDITARSE
  ====================================================== */

  // Bloquea cambios en documentos registrados o en revisión y en expedientes ya entregados,
  // salvo cuando el rechazo habilita correcciones.
  private async assertEditable(
    documentacion: DocumentacionInicialDocument,
  ): Promise<void> {
    if (documentacion.casoId || documentacion.$locals?.casoAsociado) {
      const caso = documentacion.casoId ? await this.casoAsignado(documentacion.tipoCaso, documentacion.casoId, String(documentacion.investigadorId)) : documentacion.$locals.casoAsociado;
      if (!caso.expedienteEnPreparacion && caso.estadoRegistro !== 'Rechazado') throw new ConflictException('El expediente ya fue enviado al analista; sus documentos son de consulta.');
    }

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

  // Crea una copia de la carátula con nombres, lugares, observaciones y espacios normalizados
  // para su presentación.
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

  // Normaliza el texto y capitaliza nombres o lugares respetando conectores internos en
  // minúscula.
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

  // Normaliza espacios y presenta las observaciones con mayúscula inicial.
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

  // Convierte la primera letra a mayúscula manteniendo el resto del texto recibido.
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
