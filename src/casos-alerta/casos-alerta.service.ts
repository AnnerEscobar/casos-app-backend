import { validarSeguimientoAbierto, guardarSeguimiento, poblarUsuariosSeguimientos } from '../common/seguimiento-terminal';
import { CreateHistoricoAlertaDto } from './dto/create-historico-alerta.dto';
import { incorporarHistorico, auditoriaSeguimiento, validarResponsableHistorico, UsuarioSesion } from '../common/historicos/caso-historico.service';
import { normalizeCaseNumber, normalizeMpNumber } from '../common/case-number.validator';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { RegistroInicialAlertaDto, CompletarAlertaDto } from './dto/gestion-alerta.dto';
import { generarExcelAlertas } from './alerta-excel';
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
  async registrarInicial(dto: RegistroInicialAlertaDto, usuario: UsuarioSesion) {
    if (usuario.role !== UserRole.ANALISTA) throw new ForbiddenException('Solo el analista registra y asigna la alerta inicial.');
    await auditoriaSeguimiento(this.casosAlertaModel, usuario, dto.investigadorAsignado);
    const caso = new this.casosAlertaModel({
      ...dto, numeroDeic: assertValidCaseNumber('alerta', dto.numeroDeic),
      investigadorAsignado: new Types.ObjectId(dto.investigadorAsignado),
      registradoPor: new Types.ObjectId(usuario.userId),
      procesoAlerta: true, expedienteEnPreparacion: true, estadoRegistro: EstadoRegistro.PENDIENTE,
      fileUrls: [], seguimientos: [], historialRevisiones: [],
    });
    try { return await caso.save(); }
    catch (e) {
      if(e.code===11000) throw new ConflictException('Ya existe una alerta con estos identificadores.');
      if(e.name==='ValidationError') throw new BadRequestException(e.message);
      throw e;
    }
  }

  async gestion(usuario: UsuarioSesion) {
    if (![UserRole.ANALISTA,UserRole.INVESTIGADOR].includes(usuario.role)) throw new ForbiddenException();
    return this.casosAlertaModel.find({ procesoAlerta: true,
      ...(usuario.role===UserRole.INVESTIGADOR ? {investigadorAsignado:usuario.userId} : {}),
    }).populate('investigadorAsignado','nombre').populate('registradoPor','nombre').sort({createdAt:-1}).exec();
  }

  async detalleGestion(id: string, usuario: UsuarioSesion) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Identificador de alerta inválido.');
    const caso=await this.casosAlertaModel.findById(id);
    if(!caso || !caso.procesoAlerta) throw new NotFoundException('Registro de alerta no encontrado.');
    if(usuario.role!==UserRole.ANALISTA && !(usuario.role===UserRole.INVESTIGADOR && String(caso.investigadorAsignado)===String(usuario.userId))) throw new ForbiddenException('Esta alerta no está asignada a tu usuario.');
    return caso;
  }

  async completar(id: string, dto: CompletarAlertaDto, usuario: UsuarioSesion) {
    const caso=await this.detalleGestion(id,usuario);
    if(usuario.role!==UserRole.INVESTIGADOR) throw new ForbiddenException('El investigador asignado completa el expediente.');
    if(!caso.expedienteEnPreparacion && caso.estadoRegistro!==EstadoRegistro.RECHAZADO) throw new ConflictException('El expediente ya se envió a revisión.');
    const datos={...dto};
    const plano=(value:any)=>typeof value?.toObject==='function'?value.toObject():value;
    // Las observaciones del analista se preservan durante la edición del investigador.
    if('fichaAlerta' in datos) datos.fichaAlerta={...plano(caso.fichaAlerta),...datos.fichaAlerta,observacionesAnalista:caso.fichaAlerta?.observacionesAnalista};
    if(datos.direccion) datos.direccion={...plano(caso.direccion),...datos.direccion};
    if(datos.denunciante) datos.denunciante={...plano(caso.denunciante),...datos.denunciante};
    caso.set(datos);
    try {return await caso.save();} catch(e){
      if(e.code===11000) throw new ConflictException('Ya existe una alerta con estos identificadores.');
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
    if(!caso.nombreDesaparecido?.trim() || !caso.estadoInvestigacion || !caso.numeroMp || !caso.numeroAlerta || !caso.direccion?.departamento || !caso.direccion?.municipio || !caso.direccion?.direccionDetallada) throw new BadRequestException('Completa identificación, estado de investigación y lugar de desaparición antes de entregar.');
    if(!caso.fecha_Nac) throw new BadRequestException('La fecha de nacimiento es obligatoria para que el investigador entregue el expediente.');
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
    const casos=await this.casosAlertaModel.find({}).populate('investigadorAsignado','nombre').populate('investigadorOriginal.usuarioId','nombre').sort({fechaIngreso:1,createdAt:1}).lean().exec();
    return generarExcelAlertas(casos);
  }

  async incorporarHistorico(dto: CreateHistoricoAlertaDto, usuario: UsuarioSesion, file?: Express.Multer.File) {
    const { lugarDesaparicion, datosLocalizacion, ...datos } = dto;
    return incorporarHistorico(this.casosAlertaModel, 'alerta', dto, {
      ...datos, direccion: lugarDesaparicion,
      direccionLocalizacion: datosLocalizacion?.direccionLocalizacion,
      nombreAcompanante: datosLocalizacion?.nombrePersonaConQuienEstaba,
      telefono: datosLocalizacion?.telefono,
      horaLocalizacion: datosLocalizacion?.horaLocalizacion,
      fechaLocalizacion: datosLocalizacion?.fechaLocalizacion,
    }, usuario, file ? { file, subir: (archivo, numero) => this.subirDocumentoCaso(archivo, numero) } : undefined);
  }


  private async subirDocumentoCaso(file: Express.Multer.File, numeroDeic: string): Promise<string> {
    const renamedFile = { ...file, originalname: `${numeroDeic}${extname(file.originalname)}` };
    const uploadedUrl = await this.googleApiService.uploadFile(renamedFile);
    const extractedFileId = uploadedUrl.match(/id=([^&]+)/)?.[1];
    if (!extractedFileId) {
      throw new BadRequestException('No se pudo extraer el ID del archivo de Google Drive.');
    }
    return `https://drive.google.com/uc?export=download&id=${extractedFileId}`;
  }

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
      const fileUrl = file ? await this.subirDocumentoCaso(file, numeroDeic) : null;

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
    numeroMp = normalizeMpNumber(numeroMp);

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
    usuario: UsuarioSesion,
  ) {
    numeroDeic = normalizeCaseNumber(numeroDeic);
    const auditoria = await auditoriaSeguimiento(this.casosAlertaModel, usuario, dto.investigadorAsignado);
    const caso = await this.casosAlertaModel.findOne({ numeroDeic });

    if (!caso) {
      throw new NotFoundException('Caso de alerta no encontrado');
    }
    validarSeguimientoAbierto('alerta', caso);
    const cantidadAnterior = caso.seguimientos?.length ?? 0;
    validarResponsableHistorico(caso, auditoria);

    // Subir archivos de seguimiento
    const fileUrls = await Promise.all(
      (files ?? []).map((file, index) => {
        const nombre = `Seguimiento(${index + 1})-${numeroDeic}${extname(file.originalname)}`;
        const renamed = { ...file, originalname: nombre };
        return this.googleApiService.uploadFile(renamed);
      })
    );


    // Construir objeto seguimiento
    const seguimiento = {
      ...auditoria,
      nuevoEstado: dto.nuevoEstado,
      fecha: new Date(),
      nombreAcompanante: dto.nombreAcompanante,
      telefono: dto.telefono,
      direccionLocalizacion: dto.direccionLocalizacion,
      horaLocalizacion: dto.horaLocalizacion,
      fechaLocalizacion: dto.fechaLocalizacion,
      archivos: fileUrls,
    };

    if (dto.nuevoEstado !== undefined) caso.estadoInvestigacion = dto.nuevoEstado;

    caso.seguimientos ??= [];
    caso.seguimientos.push(seguimiento);

    console.log('Seguimientos antes de guardar:', caso.seguimientos);
    console.log('Agregando seguimiento:', seguimiento);
    console.log('Total seguimientos ahora:', caso.seguimientos.length);


    caso.markModified('seguimientos');
    await guardarSeguimiento(caso, cantidadAnterior);
    await poblarUsuariosSeguimientos(caso);
    return { message: 'Seguimiento agregado correctamente', seguimiento: caso.seguimientos[caso.seguimientos.length - 1] };
  }

  async buscarPorNumeroDeic(
    numeroDeic: string
  ): Promise<CasosAlerta> {
    numeroDeic = normalizeCaseNumber(numeroDeic);

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

    if (caso.origenCaso === 'HISTORICO') {
      await caso.populate([
        { path: 'registradoPor', select: 'nombre' },
        { path: 'investigadorOriginal.usuarioId', select: 'nombre' },
      ]);
    }
    await poblarUsuariosSeguimientos(caso);
    return caso;
  }


  async findPendientes(): Promise<CasosAlertaDocument[]> {

    return this.casosAlertaModel
      .find({
        estadoRegistro: EstadoRegistro.PENDIENTE,
        expedienteEnPreparacion: { $ne: true },
      })
      .populate(
        'registradoPor',
        'nombre email role'
      )
      .populate('investigadorAsignado','nombre')
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
    if(caso.procesoAlerta && (caso.expedienteEnPreparacion || !caso.fileUrls?.length)) throw new BadRequestException('El investigador aún no ha entregado el expediente.');

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
    if(caso.procesoAlerta && caso.expedienteEnPreparacion) throw new BadRequestException('El expediente aún está en preparación.');

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
        $or: [
          { procesoAlerta: true, investigadorAsignado: new Types.ObjectId(investigadorId) },
          { procesoAlerta: { $ne: true }, registradoPor: new Types.ObjectId(investigadorId) },
        ],

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
    const registro=await this.casosAlertaModel.findById(casoId);
    if(registro?.procesoAlerta) return this.entregar(casoId,{userId:investigadorId,role:UserRole.INVESTIGADOR},file);

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
