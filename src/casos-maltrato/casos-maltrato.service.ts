import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateCasosMaltratoDto } from './dto/create-casos-maltrato.dto';
import { UpdateCasosMaltratoDto } from './dto/update-casos-maltrato.dto';
import { CasosMaltrato, CasosMaltratoDocument } from './entities/casos-maltrato.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GoogleApiService } from 'src/google-api/google-api.service';
import { extname } from 'path';
import { assertValidCaseNumber, assertValidMaltratoMpNumber } from 'src/common/case-number.validator';
import { EstadoRegistro } from 'src/common/enums/estado-registro.enum';
import { UserRole } from 'src/auth/enums/user-role.enum';
import { TipoRevisionRegistro } from 'src/common/enums/tipo-revision-registro.enum';


@Injectable()
export class CasosMaltratoService {

  constructor(
    @InjectModel(CasosMaltrato.name)
    private readonly casoModel: Model<CasosMaltratoDocument>,
    private googleApiService: GoogleApiService
  ) { }


async create(
  createCasosMaltratoDto: CreateCasosMaltratoDto,
  file: Express.Multer.File,
  usuario: {
    userId: string;
    role: UserRole;
  }
): Promise<CasosMaltrato> {

  if (!file) {
    throw new BadRequestException(
      'El informe PDF es obligatorio para registrar el caso'
    );
  }

  try {

    const numeroDeic = assertValidCaseNumber(
      'maltrato',
      createCasosMaltratoDto.numeroDeic
    );

    const numeroMp = assertValidMaltratoMpNumber(
      createCasosMaltratoDto.numeroMp
    );


    // Verificar duplicado antes de subir el PDF
    const existingCaso =
      await this.casoModel.findOne({
        numeroDeic
      });

    if (existingCaso) {
      throw new BadRequestException(
        'El caso con este número DEIC ya está registrado. No se guardará el archivo.'
      );
    }


    // Estado según usuario que registra
    let estadoRegistro: EstadoRegistro;

    if (
      usuario.role === UserRole.ANALISTA
    ) {

      estadoRegistro =
        EstadoRegistro.APROBADO;

    } else if (
      usuario.role === UserRole.INVESTIGADOR
    ) {

      estadoRegistro =
        EstadoRegistro.PENDIENTE;

    } else {

      throw new BadRequestException(
        'Tu rol no tiene permitido registrar casos'
      );

    }


    // Subir PDF a Google Drive
    const newFileName =
      `${numeroDeic}${extname(file.originalname)}`;

    const renamedFile = {
      ...file,
      originalname: newFileName,
    };

    const fileUrl =
      await this.googleApiService.uploadFile(
        renamedFile
      );


    // DTO V3
    const {
      sindicados,
      victimas,
      lugarHechos,
      ...datosCaso
    } = createCasosMaltratoDto;


    const newCaso =
      new this.casoModel({

        ...datosCaso,

        numeroDeic,
        numeroMp,

        // V3 frontend/backend:
        // sindicados
        //
        // Mongo histórico V2:
        // infractores
        infractores:
          sindicados,

        victimas,

        lugarHechos,

        // Mongo solo guarda la URL
        fileUrls: [
          fileUrl
        ],

        registradoPor:
          new Types.ObjectId(
            usuario.userId
          ),

        estadoRegistro,

        revisadoPor: null,

        fechaRevision: null,

        motivoRechazo: null,

      });


    return await newCaso.save();

  } catch (error) {

    if (
      error instanceof
      BadRequestException
    ) {
      throw error;
    }

    console.error(
      'Error creando caso de maltrato:',
      error
    );

    throw new BadRequestException(
      `Error al crear el caso, ${
        error instanceof Error
          ? error.message
          : String(error)
      }`
    );

  }

}

  async findAll(): Promise<CasosMaltratoDocument[]> {

    try {

      const maltratos = await this.casoModel.find({
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

      return maltratos;

    } catch (error) {

      throw new Error(
        `Error al obtener los casos de maltrato, ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async agregarSeguimiento(numeroDeic: string, estado: string, file: Express.Multer.File) {
    const caso = await this.casoModel.findOne({ numeroDeic });

    if (!caso) {
      throw new NotFoundException('Caso no encontrado');
    }
    // ID de la carpeta de Maltrato en Drive
    let fileUrl: string | null = null;

    if (file) {
      const numeroSeguimiento = caso.seguimientos.length + 1;
      const newFileName = `Seguimiento(${numeroSeguimiento})-${numeroDeic}${extname(file.originalname)}`;
      const renamedFile = {
        ...file,
        originalname: newFileName,
      };
      fileUrl = await this.googleApiService.uploadFile(renamedFile);
    }

    const seguimiento = {
      fecha: new Date(),
      estado,
      archivos: fileUrl ? [fileUrl] : [],
    };

    caso.seguimientos.push(seguimiento);
    caso.estadoInvestigacion = estado;
    console.log('Subiendo archivo a carpeta de pruebas...');
    await caso.save();
    console.log('Archivo subido con éxito:');
    return { mensaje: 'Seguimiento agregado correctamente', seguimiento };
  }


  async buscarPorNumeroDeic(
    numeroDeic: string
  ): Promise<CasosMaltratoDocument> {

    const caso = await this.casoModel.findOne({

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
        `No se encontró ningún caso aprobado con número DEIC: ${numeroDeic}`
      );
    }

    return caso;
  }


  //buscar casos pendientes de registro, para que el analista pueda aprobar o rechazar
  async findPendientes(): Promise<CasosMaltratoDocument[]> {

    return this.casoModel
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
  //metodo para aprobar un caso pendiente de registro
  async aprobarRegistro(
    casoId: string,
    analistaId: string
  ): Promise<CasosMaltratoDocument> {

    const caso = await this.casoModel.findById(casoId);

    if (!caso) {
      throw new NotFoundException(
        'Caso de maltrato no encontrado'
      );
    }

    if (caso.estadoRegistro !== EstadoRegistro.PENDIENTE) {
      throw new BadRequestException(
        'Solo los registros pendientes pueden ser aprobados'
      );
    }

    const fechaAprobacion = new Date();
    caso.estadoRegistro = EstadoRegistro.APROBADO;

    caso.revisadoPor =
      new Types.ObjectId(analistaId);

    caso.fechaRevision = fechaAprobacion;

    caso.historialRevisiones ??= [];

    caso.historialRevisiones.push({
      tipo: TipoRevisionRegistro.APROBACION,
      usuario: new Types.ObjectId(analistaId),
      fecha: fechaAprobacion,
      observacion: 'Registro aprobado.',
      archivoUrl: null,
    });

    caso.motivoRechazo = undefined;

    await caso.save();

    return caso;
  }


  //metodo para rechazar un caso pendiente de registro
  async rechazarRegistro(
    casoId: string,
    analistaId: string,
    motivo: string
  ): Promise<CasosMaltratoDocument> {

    const caso = await this.casoModel.findById(casoId);

    if (!caso) {
      throw new NotFoundException(
        'Caso de maltrato no encontrado'
      );
    }

    if (caso.estadoRegistro !== EstadoRegistro.PENDIENTE) {
      throw new BadRequestException(
        'Solo los registros pendientes pueden ser rechazados'
      );
    }

    caso.estadoRegistro = EstadoRegistro.RECHAZADO;

    caso.revisadoPor =
      new Types.ObjectId(analistaId);

    caso.fechaRevision = new Date();

    caso.motivoRechazo = motivo.trim();

    caso.historialRevisiones ??= [];

    caso.historialRevisiones.push({
      tipo: TipoRevisionRegistro.RECHAZO,
      usuario: new Types.ObjectId(analistaId),
      fecha: new Date(),
      observacion: motivo.trim(),
      archivoUrl: null,
    });

    await caso.save();

    return caso;
  }


  //consutlar mis casos pendientes de registro, para que el investigador pueda ver sus casos pendientes de aprobación o rechazo
  async findMisRegistros(
    investigadorId: string
  ): Promise<CasosMaltratoDocument[]> {

    return this.casoModel
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
      ).populate(
      'historialRevisiones.usuario',
      'nombre email role'
    )
      .sort({
        createdAt: -1
      })
      .exec();
  }


  //reeenviar caso al analista para que lo apruebe o rechace, solo si fue rechazado previamente y el investigador que lo envia es el mismo que lo registro

  async reenviarRegistro(
    casoId: string,
    investigadorId: string,
    file: Express.Multer.File
  ): Promise<CasosMaltratoDocument> {

    if (!file) {
      throw new BadRequestException(
        'Debes adjuntar el archivo corregido'
      );
    }

    const caso = await this.casoModel.findById(casoId);

    if (!caso) {
      throw new NotFoundException(
        'Caso de maltrato no encontrado'
      );
    }


    // Solo puede corregirlo quien originalmente lo registró
    if (
      !caso.registradoPor ||
      caso.registradoPor.toString() !== investigadorId.toString()
    ) {
      throw new ForbiddenException(
        'No puedes modificar un registro creado por otro investigador'
      );
    }


    // Solo los rechazados pueden volver a enviarse
    if (
      caso.estadoRegistro !== EstadoRegistro.RECHAZADO
    ) {
      throw new BadRequestException(
        'Solo los registros rechazados pueden enviarse nuevamente'
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


    // Conservamos los archivos anteriores
caso.fileUrls ??= [];

caso.fileUrls.push(
  fileUrl
);
    caso.historialRevisiones ??= [];

    caso.historialRevisiones.push({
      tipo: TipoRevisionRegistro.REENVIO,
      usuario: new Types.ObjectId(investigadorId),
      fecha: new Date(),
      observacion: 'Documento corregido enviado nuevamente para revisión.',
      archivoUrl: fileUrl,
    });


    // Regresa al panel del analista
    caso.estadoRegistro =
      EstadoRegistro.PENDIENTE;


    await caso.save();

    return caso;
  }




  //no implementados
  findOne(id: number) {
    return `This action returns a #${id} casosMaltrato`;
  }

  update(id: number, updateCasosMaltratoDto: UpdateCasosMaltratoDto) {
    return `This action updates a #${id} casosMaltrato`;
  }

  remove(id: number) {
    return `This action removes a #${id} casosMaltrato`;
  }
}
