import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCasosAlertaDto } from './dto/create-casos-alerta.dto';
import { UpdateCasosAlertaDto } from './dto/update-casos-alerta.dto';
import { InjectModel } from '@nestjs/mongoose';
import { CasosAlerta, CasosAlertaDocument, } from './entities/casos-alerta.entity';
import { Model, Types } from 'mongoose';
import { GoogleApiService } from 'src/google-api/google-api.service';
import { extname } from 'path';
import { assertValidAlertaMpNumber, assertValidCaseNumber } from 'src/common/case-number.validator';
import { EstadoRegistro } from 'src/common/enums/estado-registro.enum';
import { UserRole } from 'src/auth/enums/user-role.enum';
import { TipoRevisionRegistro } from 'src/common/enums/tipo-revision-registro.enum';

@Injectable()
export class CasosAlertaService {

  constructor(
    @InjectModel(CasosAlerta.name)
    private readonly casosAlertaModel: Model<CasosAlertaDocument>,
    private readonly googleApiService: GoogleApiService
  ) { }


  //Metodo para crear un caso
  async create(
    createCasosAlertaDto: CreateCasosAlertaDto,
    file: Express.Multer.File,
    usuario: {
      userId: string;
      role: UserRole;
    }
  ): Promise<CasosAlerta> {

    try {

      const numeroDeic = assertValidCaseNumber(
        'alerta',
        createCasosAlertaDto.numeroDeic
      );

      const numeroMp = assertValidAlertaMpNumber(
        createCasosAlertaDto.numeroMp
      );


      // Verificar si ya existe
      const existingCaso = await this.casosAlertaModel.findOne({
        numeroDeic
      });

      if (existingCaso) {
        throw new BadRequestException(
          'El caso con este número DEIC ya está registrado. No se guardará el archivo.'
        );
      }


      // Estado de autorización según el rol
      let estadoRegistro: EstadoRegistro;

      if (usuario.role === UserRole.ANALISTA) {

        estadoRegistro = EstadoRegistro.APROBADO;

      } else if (usuario.role === UserRole.INVESTIGADOR) {

        estadoRegistro = EstadoRegistro.PENDIENTE;

      } else {

        throw new BadRequestException(
          'Tu rol no tiene permitido registrar casos'
        );
      }


      // Subir archivo
      let fileUrl: string | null = null;

      if (file) {

        const newFileName =
          `${numeroDeic}${extname(file.originalname)}`;

        const renamedFile = {
          ...file,
          originalname: newFileName,
        };

        const uploadedUrl =
          await this.googleApiService.uploadFile(renamedFile);

        const fileIdRegex = /id=([^&]+)/;
        const match = uploadedUrl.match(fileIdRegex);

        const extractedFileId =
          match ? match[1] : null;

        if (!extractedFileId) {
          throw new BadRequestException(
            'No se pudo extraer el ID del archivo de Google Drive.'
          );
        }

        fileUrl =
          `https://drive.google.com/uc?export=download&id=${extractedFileId}`;
      }


      /*
       * Extraemos los campos V3 que necesitan
       * convertirse al formato histórico de Mongo.
       */
      const {
        lugarDesaparicion,
        datosLocalizacion,
        denunciante,
        ...datosCaso
      } = createCasosAlertaDto;


      const newCaso = new this.casosAlertaModel({

        ...datosCaso,

        numeroDeic,
        numeroMp,

        // V3
        denunciante,

        // V3 → compatibilidad con Mongo V2
        direccion: lugarDesaparicion,

        direccionLocalizacion:
          datosLocalizacion?.direccionLocalizacion,

        nombreAcompanante:
          datosLocalizacion?.nombrePersonaConQuienEstaba,

        telefono:
          datosLocalizacion?.telefono,

        horaLocalizacion:
          datosLocalizacion?.horaLocalizacion,

        fechaLocalizacion:
          datosLocalizacion?.fechaLocalizacion,


        fileUrls: fileUrl
          ? [fileUrl]
          : [],


        // Flujo de autorización
        registradoPor:
          new Types.ObjectId(usuario.userId),

        estadoRegistro,

        revisadoPor: null,

        fechaRevision: null,

        motivoRechazo: null,

        historialRevisiones: [],
      });


      return await newCaso.save();

    } catch (error) {

      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error(
        'Error interno al crear el caso:',
        error
      );

      throw new BadRequestException(
        `Error al crear el caso, ${error}`
      );
    }
  }

  //cruds creados por el nestjsd
  async findAll(): Promise<CasosAlerta[]> {
    try {
      const alertas = await this.casosAlertaModel.find({
        $or: [
          {
            estadoRegistro: EstadoRegistro.APROBADO
          },
          {
            estadoRegistro: {
              $exists: false
            }
          }
        ]
      }).exec();
      return alertas;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Error al obtener los casos de alerta, ${errorMessage}`);
    }
  }

  // Método para buscar alertas por número de expediente MP
  async buscarPorNumeroMp(
    numeroMp: string
  ): Promise<CasosAlerta[]> {

    const alertas = await this.casosAlertaModel.find({

      numeroMp,

      $or: [
        {
          estadoRegistro: EstadoRegistro.APROBADO
        },
        {
          estadoRegistro: {
            $exists: false
          }
        }
      ]

    }).exec();


    if (alertas.length === 0) {

      throw new NotFoundException(
        'No se encontraron alertas aprobadas con el número de expediente MP proporcionado.'
      );
    }


    return alertas;
  }

  //metodo para agregar un seguimiento a un caso

  async actualizarCasoConSeguimiento(
    numeroDeic: string,
    dto: UpdateCasosAlertaDto,
    files: Express.Multer.File[],
  ) {
    const caso = await this.casosAlertaModel.findOne({ numeroDeic });

    if (!caso) {
      throw new NotFoundException('Caso de alerta no encontrado');
    }

    // Subir archivos de seguimiento
    const fileUrls = await Promise.all(
      files.map((file, index) => {
        const nombre = `Seguimiento(${index + 1})-${numeroDeic}${extname(file.originalname)}`;
        const renamed = { ...file, originalname: nombre };
        return this.googleApiService.uploadFile(renamed);
      })
    );


    // Construir objeto seguimiento
    const seguimiento = {
      nuevoEstado: dto.nuevoEstado,
      fecha: new Date(),
      nombreAcompanante: dto.nombreAcompanante,
      telefono: dto.telefono,
      direccionLocalizacion: dto.direccionLocalizacion,
      horaLocalizacion: dto.horaLocalizacion,
      fechaLocalizacion: dto.fechaLocalizacion,
      archivos: fileUrls,
    };

    caso.estadoInvestigacion = dto.nuevoEstado;

    caso.seguimientos = caso.seguimientos || [];
    caso.seguimientos.push(seguimiento);

    console.log('Seguimientos antes de guardar:', caso.seguimientos);
    console.log('Agregando seguimiento:', seguimiento);
    console.log('Total seguimientos ahora:', caso.seguimientos.length);


    caso.markModified('seguimientos');
    await caso.save();
    return { message: 'Seguimiento agregado correctamente', seguimiento };
  }

  async buscarPorNumeroDeic(
    numeroDeic: string
  ): Promise<CasosAlerta> {

    const caso = await this.casosAlertaModel.findOne({

      numeroDeic,

      $or: [
        {
          estadoRegistro: EstadoRegistro.APROBADO
        },
        {
          estadoRegistro: {
            $exists: false
          }
        }
      ]

    });

    if (!caso) {
      throw new NotFoundException(
        'No se encontró un caso de alerta aprobado con ese número DEIC.'
      );
    }

    return caso;
  }


  async findPendientes(): Promise<CasosAlertaDocument[]> {

    return this.casosAlertaModel
      .find({
        estadoRegistro: EstadoRegistro.PENDIENTE
      })
      .populate(
        'registradoPor',
        'nombre email role'
      )
      .populate(
        'revisadoPor',
        'nombre email role'
      )
      .populate(
        'historialRevisiones.usuario',
        'nombre email role'
      )
      .sort({
        createdAt: -1
      })
      .exec();
  }

  async aprobarRegistro(
    casoId: string,
    analistaId: string
  ): Promise<CasosAlertaDocument> {

    const caso =
      await this.casosAlertaModel.findById(casoId);

    if (!caso) {
      throw new NotFoundException(
        'Caso de alerta no encontrado'
      );
    }

    if (
      caso.estadoRegistro !== EstadoRegistro.PENDIENTE
    ) {
      throw new BadRequestException(
        'Solo los registros pendientes pueden ser aprobados'
      );
    }

    const fechaAprobacion = new Date();

    caso.estadoRegistro =
      EstadoRegistro.APROBADO;

    caso.revisadoPor =
      new Types.ObjectId(analistaId);

    caso.fechaRevision =
      fechaAprobacion;

    caso.motivoRechazo =
      null;

    caso.historialRevisiones ??= [];

    caso.historialRevisiones.push({
      tipo: TipoRevisionRegistro.APROBACION,
      usuario: new Types.ObjectId(analistaId),
      fecha: fechaAprobacion,
      observacion: 'Registro aprobado.',
      archivoUrl: null,
    });

    await caso.save();

    return caso;
  }


  async rechazarRegistro(
    casoId: string,
    analistaId: string,
    motivo: string
  ): Promise<CasosAlertaDocument> {

    const caso =
      await this.casosAlertaModel.findById(casoId);

    if (!caso) {
      throw new NotFoundException(
        'Caso de alerta no encontrado'
      );
    }

    if (
      caso.estadoRegistro !== EstadoRegistro.PENDIENTE
    ) {
      throw new BadRequestException(
        'Solo los registros pendientes pueden ser rechazados'
      );
    }

    const fechaRechazo = new Date();

    caso.estadoRegistro =
      EstadoRegistro.RECHAZADO;

    caso.revisadoPor =
      new Types.ObjectId(analistaId);

    caso.fechaRevision =
      fechaRechazo;

    caso.motivoRechazo =
      motivo.trim();

    caso.historialRevisiones ??= [];

    caso.historialRevisiones.push({
      tipo: TipoRevisionRegistro.RECHAZO,
      usuario: new Types.ObjectId(analistaId),
      fecha: fechaRechazo,
      observacion: motivo.trim(),
      archivoUrl: null,
    });

    await caso.save();

    return caso;
  }


  async findMisRegistros(

    investigadorId: string
  ): Promise<CasosAlertaDocument[]> {

    if (!Types.ObjectId.isValid(investigadorId)) {
      throw new BadRequestException(
        'Identificador de investigador inválido'
      );
    }

    return this.casosAlertaModel
      .find({
        registradoPor: new Types.ObjectId(investigadorId),

        estadoRegistro: {
          $in: [
            EstadoRegistro.PENDIENTE,
            EstadoRegistro.RECHAZADO
          ]
        }
      })
      .populate(
        'revisadoPor',
        'nombre email role'
      )
      .populate(
        'historialRevisiones.usuario',
        'nombre email role'
      )
      .sort({
        createdAt: -1
      })
      .exec();
  }


  //termina metodo para buscar mis registros

  async reenviarRegistro(
    casoId: string,
    investigadorId: string,
    file: Express.Multer.File
  ): Promise<CasosAlertaDocument> {

    const caso =
      await this.casosAlertaModel.findById(casoId);

    if (!caso) {
      throw new NotFoundException(
        'Caso de alerta no encontrado'
      );
    }


    if (
      !caso.registradoPor ||
      caso.registradoPor.toString() !== investigadorId.toString()
    ) {
      throw new ForbiddenException(
        'No puedes modificar un registro creado por otro investigador'
      );
    }


    if (
      caso.estadoRegistro !== EstadoRegistro.RECHAZADO
    ) {
      throw new BadRequestException(
        'Solo los registros rechazados pueden enviarse nuevamente'
      );
    }


    if (!file) {
      throw new BadRequestException(
        'Debes adjuntar el archivo corregido'
      );
    }


    const numeroCorreccion =
      caso.fileUrls?.length ?? 0;

    const newFileName =
      `Correccion(${numeroCorreccion})-${caso.numeroDeic}${extname(file.originalname)}`;

    const renamedFile = {
      ...file,
      originalname: newFileName,
    };


    const fileUrl =
      await this.googleApiService.uploadFile(
        renamedFile
      );


    caso.fileUrls ??= [];

    caso.fileUrls.push(fileUrl);


    caso.historialRevisiones ??= [];

    caso.historialRevisiones.push({

      tipo: TipoRevisionRegistro.REENVIO,

      usuario:
        new Types.ObjectId(investigadorId),

      fecha:
        new Date(),

      observacion:
        'Documento corregido enviado nuevamente para revisión.',

      archivoUrl:
        fileUrl,

    });


    caso.estadoRegistro =
      EstadoRegistro.PENDIENTE;


    await caso.save();
    return caso;
  }


}
