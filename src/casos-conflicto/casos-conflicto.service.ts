import { GoogleApiService } from 'src/google-api/google-api.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { CreateCasosConflictoDto } from './dto/create-casos-conflicto.dto';
import { UpdateCasosConflictoDto } from './dto/update-casos-conflicto.dto';
import { InjectModel } from '@nestjs/mongoose';
import { CasosConflicto, CasosConflictoDocument } from './entities/casos-conflicto.entity';
import { Model, Types } from 'mongoose';
import { extname } from 'path';
import { assertValidCaseNumber, assertValidConflictoMpNumber } from 'src/common/case-number.validator';
import { EstadoRegistro } from 'src/common/enums/estado-registro.enum';
import { TipoRevisionRegistro } from 'src/common/enums/tipo-revision-registro.enum';
import { UserRole } from 'src/auth/enums/user-role.enum';

@Injectable()
export class CasosConflictoService {

  constructor(
    @InjectModel(CasosConflicto.name) 
    private readonly casoModel: Model<CasosConflictoDocument>,
    private googleApiService: GoogleApiService
  ) {}

async create(
  createCasosConflictoDto: CreateCasosConflictoDto,
  file: Express.Multer.File,
  usuario: {
    userId: string;
    role: UserRole;
  }
): Promise<CasosConflicto> {

  if (!file) {
  throw new BadRequestException(
    'El informe PDF es obligatorio para registrar el caso'
  );
}

  try {

    const numeroDeic = assertValidCaseNumber(
      'conflicto',
      createCasosConflictoDto.numeroDeic
    );

    const numeroMp = assertValidConflictoMpNumber(
      createCasosConflictoDto.numeroMp
    );


    // Verificar si ya existe
    const existingCaso = await this.casoModel.findOne({
      numeroDeic
    });

    if (existingCaso) {
      throw new BadRequestException(
        'El caso con este número DEIC ya está registrado. No se guardará el archivo.'
      );
    }


    // Determinar estado del registro
    let estadoRegistro: EstadoRegistro;

    if (usuario.role === UserRole.ANALISTA) {

      estadoRegistro = EstadoRegistro.APROBADO;

    } else if (
      usuario.role === UserRole.INVESTIGADOR
    ) {

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

      fileUrl =
        await this.googleApiService.uploadFile(
          renamedFile
        );
    }


    const newCaso = new this.casoModel({

      ...createCasosConflictoDto,

      numeroDeic,
      numeroMp,

      fileUrls: fileUrl
        ? [fileUrl]
        : [],

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
      'Error interno al crear el caso de conflicto:',
      error
    );

    throw new BadRequestException(
      `Error al crear el caso, ${error}`
    );
  }
}

 async findAll(): Promise<CasosConflictoDocument[]> {

  try {

    return await this.casoModel.find({

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

  } catch (error) {

    throw new BadRequestException(
      `Error al obtener los casos de conflicto, ${error}`
    );
  }
}

  
  async agregarSeguimiento(numeroDeic: string, estado: string, file: Express.Multer.File) {
    const caso = await this.casoModel.findOne({ numeroDeic });
  
    if (!caso) {
      throw new NotFoundException('Caso no encontrado');
    }
   // ID de la carpeta de Conflictos en Drive
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
): Promise<CasosConflictoDocument> {

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

async findPendientes(): Promise<CasosConflictoDocument[]> {

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


async aprobarRegistro(
  casoId: string,
  analistaId: string
): Promise<CasosConflictoDocument> {

  const caso =
    await this.casoModel.findById(casoId);

  if (!caso) {
    throw new NotFoundException(
      'Caso de conflicto no encontrado'
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

    tipo:
      TipoRevisionRegistro.APROBACION,

    usuario:
      new Types.ObjectId(analistaId),

    fecha:
      fechaAprobacion,

    observacion:
      'Registro aprobado.',

    archivoUrl:
      null,
  });


  await caso.save();

  return caso;
}

async rechazarRegistro(
  casoId: string,
  analistaId: string,
  motivo: string
): Promise<CasosConflictoDocument> {

  const caso =
    await this.casoModel.findById(casoId);

  if (!caso) {
    throw new NotFoundException(
      'Caso de conflicto no encontrado'
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

    tipo:
      TipoRevisionRegistro.RECHAZO,

    usuario:
      new Types.ObjectId(analistaId),

    fecha:
      fechaRechazo,

    observacion:
      motivo.trim(),

    archivoUrl:
      null,
  });


  await caso.save();

  return caso;
}

async findMisRegistros(
  investigadorId: string
): Promise<CasosConflictoDocument[]> {

  return this.casoModel
    .find({

      registradoPor:
        new Types.ObjectId(investigadorId),

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


async reenviarRegistro(
  casoId: string,
  investigadorId: string,
  file: Express.Multer.File
): Promise<CasosConflictoDocument> {

  if (!file) {
    throw new BadRequestException(
      'Debes adjuntar el archivo corregido'
    );
  }


  const caso =
    await this.casoModel.findById(
      casoId
    );


  if (!caso) {
    throw new NotFoundException(
      'Caso de conflicto no encontrado'
    );
  }


  if (
    !caso.registradoPor ||
    caso.registradoPor.toString() !==
      investigadorId.toString()
  ) {
    throw new ForbiddenException(
      'No puedes modificar un registro creado por otro investigador'
    );
  }


  if (
    caso.estadoRegistro !==
    EstadoRegistro.RECHAZADO
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


  caso.fileUrls ??= [];

  caso.fileUrls.push(
    fileUrl
  );


  caso.historialRevisiones ??= [];

  caso.historialRevisiones.push({

    tipo:
      TipoRevisionRegistro.REENVIO,

    usuario:
      new Types.ObjectId(
        investigadorId
      ),

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
  


  //metodos sin implementar

  findOne(id: number) {
    return `This action returns a #${id} casosConflicto`;
  }

  update(id: number, updateCasosConflictoDto: UpdateCasosConflictoDto) {
    return `This action updates a #${id} casosConflicto`;
  }

  remove(id: number) {
    return `This action removes a #${id} casosConflicto`;
  }
}
