import { RegistroInicialConflictoDto, CompletarConflictoDto } from './dto/gestion-conflicto.dto';
import { generarExcelConflictos } from './conflicto-excel';
import { validarSeguimientoAbierto, guardarSeguimiento, poblarUsuariosSeguimientos } from '../common/seguimiento-terminal';
import { CreateHistoricoConflictoDto } from './dto/create-historico-conflicto.dto';
import { incorporarHistorico, auditoriaSeguimiento, validarResponsableHistorico, UsuarioSesion } from '../common/historicos/caso-historico.service';
import { normalizeCaseNumber } from '../common/case-number.validator';
import { GoogleApiService } from 'src/google-api/google-api.service';
import {
  BadRequestException,
  ConflictException,
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
  async registrarInicial(dto: RegistroInicialConflictoDto, usuario: UsuarioSesion) {
    if (usuario.role !== UserRole.ANALISTA) throw new ForbiddenException('Solo el analista registra y asigna el caso inicial de conflicto.');
    await auditoriaSeguimiento(this.casoModel, usuario, dto.investigadorAsignado);
    const caso = new this.casoModel({
      ...dto, numeroDeic: assertValidCaseNumber('conflicto', dto.numeroDeic),
      investigadorAsignado: new Types.ObjectId(dto.investigadorAsignado),
      registradoPor: new Types.ObjectId(usuario.userId),
      procesoConflicto: true, expedienteEnPreparacion: true, estadoRegistro: EstadoRegistro.PENDIENTE,
      fileUrls: [], seguimientos: [], historialRevisiones: [],
    });
    try { return await caso.save(); }
    catch (e) {
      if(e.code===11000) throw new ConflictException('Ya existe un caso de conflicto con estos identificadores.');
      if(e.name==='ValidationError') throw new BadRequestException(e.message);
      throw e;
    }
  }

  async gestion(usuario: UsuarioSesion) {
    if (![UserRole.ANALISTA,UserRole.INVESTIGADOR].includes(usuario.role)) throw new ForbiddenException();
    return this.casoModel.find({ procesoConflicto: true,
      ...(usuario.role===UserRole.INVESTIGADOR ? {investigadorAsignado:usuario.userId} : {}),
    }).populate('investigadorAsignado','nombre').populate('registradoPor','nombre').sort({createdAt:-1}).exec();
  }

  async detalleGestion(id: string, usuario: UsuarioSesion) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Identificador de conflicto inválido.');
    const caso=await this.casoModel.findById(id);
    if(!caso || !caso.procesoConflicto) throw new NotFoundException('Registro de conflicto no encontrado.');
    if(usuario.role!==UserRole.ANALISTA && !(usuario.role===UserRole.INVESTIGADOR && String(caso.investigadorAsignado)===String(usuario.userId))) throw new ForbiddenException('Este caso de conflicto no está asignado a tu usuario.');
    return caso;
  }

  async completar(id: string, dto: CompletarConflictoDto, usuario: UsuarioSesion) {
    const caso=await this.detalleGestion(id,usuario);
    if(usuario.role!==UserRole.INVESTIGADOR) throw new ForbiddenException('El investigador asignado completa el expediente.');
    if(!caso.expedienteEnPreparacion && caso.estadoRegistro!==EstadoRegistro.RECHAZADO) throw new ConflictException('El expediente ya se envió a revisión.');
    const datos:any={...dto};
    const plano=(value:any)=>typeof value?.toObject==='function'?value.toObject():value;
    if('fichaConflicto' in datos) datos.fichaConflicto={...plano(caso.fichaConflicto),...datos.fichaConflicto};
    if(datos.lugarHechos)datos.lugarHechos={...plano(caso.lugarHechos),...datos.lugarHechos};
    caso.set(datos);
    try {return await caso.save();} catch(e){
      if(e.code===11000) throw new ConflictException('Ya existe un caso de conflicto con estos identificadores.');
      if(e.name==='VersionError') throw new ConflictException('El expediente cambió. Vuelve a consultarlo.');
      if(e.name==='ValidationError') throw new BadRequestException(e.message);
      throw e;
    }
  }

  async entregar(id: string, usuario: UsuarioSesion, file: Express.Multer.File) {
    const caso=await this.detalleGestion(id,usuario);
    if(usuario.role!==UserRole.INVESTIGADOR) throw new ForbiddenException();
    if(!caso.expedienteEnPreparacion && caso.estadoRegistro!==EstadoRegistro.RECHAZADO) throw new ConflictException('El expediente ya se envió a revisión.');
    if(!file) throw new BadRequestException('Adjunta el expediente completo en PDF.');
    if(!caso.numeroMp || !caso.estadoInvestigacion || !caso.lugarHechos?.departamento?.trim() || !caso.lugarHechos?.municipio?.trim() || !caso.lugarHechos?.direccionDetallada?.trim()) throw new BadRequestException('Completa MP, estado de investigación y lugar de los hechos.');
    if(!caso.infractores?.length || caso.infractores.some(v=>!v.nombre?.trim() || (!v.fecha_Nac && v.edadReportada==null))) throw new BadRequestException('Completa el nombre y la fecha de nacimiento o edad conocida de cada adolescente infractor.');
    if(caso.victimas?.some(v=>!v.nombre?.trim())) throw new BadRequestException('Completa los nombres de las víctimas o denunciantes o retira las filas vacías.');
    await caso.validate();
    const url=await this.subirDocumentoCaso(file,caso.numeroDeic);
    caso.fileUrls.push(url);
    caso.historialRevisiones.push({tipo:TipoRevisionRegistro.REENVIO,usuario:new Types.ObjectId(usuario.userId),fecha:new Date(),observacion:'Expediente completo enviado para revisión.',archivoUrl:url});
    caso.estadoRegistro=EstadoRegistro.PENDIENTE;
    caso.expedienteEnPreparacion=false;
    caso.fechaEnvioRevision=new Date();
    try {return await caso.save();} catch(e){
      if(e.name==='VersionError') throw new ConflictException('El expediente cambió durante la entrega. Vuelve a consultarlo.');
      throw e;
    }
  }

  async exportarExcel() {
    const casos=await this.casoModel.find({}).populate('investigadorAsignado','nombre').populate('investigadorOriginal.usuarioId','nombre').sort({fechaIngreso:1,createdAt:1}).lean().exec();
    return generarExcelConflictos(casos);
  }





  async incorporarHistorico(dto: CreateHistoricoConflictoDto, usuario: UsuarioSesion, file?: Express.Multer.File) {
    return incorporarHistorico(this.casoModel, 'conflicto', dto, dto, usuario, file ? { file, subir: (archivo, numero) => this.subirDocumentoCaso(archivo, numero) } : undefined);
  }


  private async subirDocumentoCaso(file: Express.Multer.File, numeroDeic: string): Promise<string> {
    const renamedFile = { ...file, originalname: `${numeroDeic}${extname(file.originalname)}` };
    return this.googleApiService.uploadFile(renamedFile);
  }

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
    const fileUrl = file ? await this.subirDocumentoCaso(file, numeroDeic) : null;

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

  
  async agregarSeguimiento(numeroDeic: string, estado: string, file: Express.Multer.File, usuario: UsuarioSesion, investigadorAsignado?: string) {
    numeroDeic = normalizeCaseNumber(numeroDeic);
    const auditoria = await auditoriaSeguimiento(this.casoModel, usuario, investigadorAsignado);
    const caso = await this.casoModel.findOne({ numeroDeic });
  
    if (!caso) {
      throw new NotFoundException('Caso no encontrado');
    }
    validarSeguimientoAbierto('conflicto', caso);
    const cantidadAnterior = caso.seguimientos?.length ?? 0;
    validarResponsableHistorico(caso, auditoria);
   // ID de la carpeta de Conflictos en Drive
    let fileUrl: string | null = null;
  
    if (file) {
      const numeroSeguimiento = (caso.seguimientos?.length ?? 0) + 1;
      const newFileName = `Seguimiento(${numeroSeguimiento})-${numeroDeic}${extname(file.originalname)}`;
      const renamedFile = {
        ...file,
        originalname: newFileName,
      };
      fileUrl = await this.googleApiService.uploadFile(renamedFile);
    }
  
    const seguimiento = {
      ...auditoria,
      fecha: new Date(),
      estado,
      archivos: fileUrl ? [fileUrl] : [],
    };
  
    caso.seguimientos ??= [];
    caso.seguimientos.push(seguimiento);
    caso.estadoInvestigacion = estado;
    console.log('Subiendo archivo a carpeta de pruebas...');
    await guardarSeguimiento(caso, cantidadAnterior);
    await poblarUsuariosSeguimientos(caso);
    console.log('Archivo subido con éxito:');
    return { mensaje: 'Seguimiento agregado correctamente', seguimiento: caso.seguimientos[caso.seguimientos.length - 1] };
  }
  
  
async buscarPorNumeroDeic(
  numeroDeic: string
): Promise<CasosConflictoDocument> {
    numeroDeic = normalizeCaseNumber(numeroDeic);

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

  if (caso.origenCaso === 'HISTORICO') {
    await caso.populate([
      { path: 'registradoPor', select: 'nombre' },
      { path: 'investigadorOriginal.usuarioId', select: 'nombre' },
    ]);
  }
  await poblarUsuariosSeguimientos(caso);
    return caso;
}

async findPendientes(): Promise<CasosConflictoDocument[]> {

  return this.casoModel
    .find({
      estadoRegistro: EstadoRegistro.PENDIENTE, expedienteEnPreparacion:{$ne:true}
    })
    .populate('investigadorAsignado','nombre')
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


  if(caso.procesoConflicto && (caso.expedienteEnPreparacion || !caso.fileUrls?.length)) throw new BadRequestException('El investigador aún no ha entregado el expediente.');
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


  if(caso.procesoConflicto && caso.expedienteEnPreparacion) throw new BadRequestException('El expediente aún está en preparación.');
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

      $or:[{procesoConflicto:true,investigadorAsignado:new Types.ObjectId(investigadorId)},{procesoConflicto:{$ne:true},registradoPor:new Types.ObjectId(investigadorId)}],

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

  const registro=await this.casoModel.findById(casoId);
  if(registro?.procesoConflicto)return this.entregar(casoId,{userId:investigadorId,role:UserRole.INVESTIGADOR},file);
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
