import { RegistroInicialMaltratoDto, CompletarMaltratoDto } from './dto/gestion-maltrato.dto';
import { generarExcelMaltratos } from './maltrato-excel';
import { validarSeguimientoAbierto, guardarSeguimiento, poblarUsuariosSeguimientos } from '../common/seguimiento-terminal';
import { CreateHistoricoMaltratoDto } from './dto/create-historico-maltrato.dto';
import { incorporarHistorico, auditoriaSeguimiento, validarResponsableHistorico, UsuarioSesion } from '../common/historicos/caso-historico.service';
import { normalizeCaseNumber } from '../common/case-number.validator';
import { BadRequestException, ConflictException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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
  async registrarInicial(dto: RegistroInicialMaltratoDto, usuario: UsuarioSesion) {
    if (usuario.role !== UserRole.ANALISTA) throw new ForbiddenException('Solo el analista registra y asigna el caso inicial de maltrato.');
    await auditoriaSeguimiento(this.casoModel, usuario, dto.investigadorAsignado);
    const caso = new this.casoModel({
      ...dto, infractores:dto.sindicados || [], numeroDeic: assertValidCaseNumber('maltrato', dto.numeroDeic),
      investigadorAsignado: new Types.ObjectId(dto.investigadorAsignado),
      registradoPor: new Types.ObjectId(usuario.userId),
      procesoMaltrato: true, expedienteEnPreparacion: true, estadoRegistro: EstadoRegistro.PENDIENTE,
      fileUrls: [], seguimientos: [], historialRevisiones: [],
    });
    try { return await caso.save(); }
    catch (e) {
      if(e.code===11000) throw new ConflictException('Ya existe un caso de maltrato con estos identificadores.');
      if(e.name==='ValidationError') throw new BadRequestException(e.message);
      throw e;
    }
  }

  async gestion(usuario: UsuarioSesion) {
    if (![UserRole.ANALISTA,UserRole.INVESTIGADOR].includes(usuario.role)) throw new ForbiddenException();
    return this.casoModel.find({ procesoMaltrato: true,
      ...(usuario.role===UserRole.INVESTIGADOR ? {investigadorAsignado:usuario.userId} : {}),
    }).populate('investigadorAsignado','nombre').populate('registradoPor','nombre').sort({createdAt:-1}).exec();
  }

  async detalleGestion(id: string, usuario: UsuarioSesion) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Identificador de maltrato inválido.');
    const caso=await this.casoModel.findById(id);
    if(!caso || !caso.procesoMaltrato) throw new NotFoundException('Registro de maltrato no encontrado.');
    if(usuario.role!==UserRole.ANALISTA && !(usuario.role===UserRole.INVESTIGADOR && String(caso.investigadorAsignado)===String(usuario.userId))) throw new ForbiddenException('Este caso de maltrato no está asignado a tu usuario.');
    return caso;
  }

  async completar(id: string, dto: CompletarMaltratoDto, usuario: UsuarioSesion) {
    const caso=await this.detalleGestion(id,usuario);
    if(usuario.role!==UserRole.INVESTIGADOR) throw new ForbiddenException('El investigador asignado completa el expediente.');
    if(!caso.expedienteEnPreparacion && caso.estadoRegistro!==EstadoRegistro.RECHAZADO) throw new ConflictException('El expediente ya se envió a revisión.');
    const {sindicados,...resto}=dto;
    const datos:any={...resto};
    if(sindicados!==undefined)datos.infractores=sindicados;
    const plano=(value:any)=>typeof value?.toObject==='function'?value.toObject():value;
    if('fichaMaltrato' in datos) datos.fichaMaltrato={...plano(caso.fichaMaltrato),...datos.fichaMaltrato};
    if(datos.lugarHechos)datos.lugarHechos={...plano(caso.lugarHechos),...datos.lugarHechos};
    caso.set(datos);
    try {return await caso.save();} catch(e){
      if(e.code===11000) throw new ConflictException('Ya existe un caso de maltrato con estos identificadores.');
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
    if(!caso.victimas?.length || caso.victimas.some(v=>!v.nombre?.trim() || (!v.fecha_Nac && v.edadReportada==null))) throw new BadRequestException('Completa el nombre y la fecha de nacimiento o edad conocida de cada víctima.');
    if(caso.infractores?.some(v=>!v.nombre?.trim())) throw new BadRequestException('Completa los nombres de los sindicados o retira las filas vacías.');
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
    return generarExcelMaltratos(casos);
  }



  async incorporarHistorico(dto: CreateHistoricoMaltratoDto, usuario: UsuarioSesion, file?: Express.Multer.File) {
    const { sindicados, ...datos } = dto;
    return incorporarHistorico(this.casoModel, 'maltrato', dto, { ...datos, infractores: sindicados }, usuario, file ? { file, subir: (archivo, numero) => this.subirDocumentoCaso(archivo, numero) } : undefined);
  }


  private async subirDocumentoCaso(file: Express.Multer.File, numeroDeic: string): Promise<string> {
    const renamedFile = { ...file, originalname: `${numeroDeic}${extname(file.originalname)}` };
    return this.googleApiService.uploadFile(renamedFile);
  }

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
      const fileUrl = await this.subirDocumentoCaso(file, numeroDeic);

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
        `Error al crear el caso, ${error instanceof Error
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

  async agregarSeguimiento(numeroDeic: string, estado: string, file: Express.Multer.File, usuario: UsuarioSesion, investigadorAsignado?: string) {
    numeroDeic = normalizeCaseNumber(numeroDeic);
    const auditoria = await auditoriaSeguimiento(this.casoModel, usuario, investigadorAsignado);

    const caso = await this.casoModel.findOne({ numeroDeic });

    if (!caso) {
      throw new NotFoundException('Caso no encontrado');
    }
    validarSeguimientoAbierto('maltrato', caso);
    if (!file) {
      throw new BadRequestException('El documento de respaldo es obligatorio para registrar el seguimiento');
    }
    const cantidadAnterior = caso.seguimientos?.length ?? 0;
    validarResponsableHistorico(caso, auditoria);
    // ID de la carpeta de Maltrato en Drive
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
  ): Promise<CasosMaltratoDocument> {
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


  //buscar casos pendientes de registro, para que el analista pueda aprobar o rechazar
  async findPendientes(): Promise<CasosMaltratoDocument[]> {

    return this.casoModel
      .find({
        estadoRegistro: EstadoRegistro.PENDIENTE,
        expedienteEnPreparacion: {$ne:true}
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

    if(caso.procesoMaltrato && (caso.expedienteEnPreparacion || !caso.fileUrls?.length)) throw new BadRequestException('El investigador aún no ha entregado el expediente.');
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

    if(caso.procesoMaltrato && caso.expedienteEnPreparacion) throw new BadRequestException('El expediente aún está en preparación.');
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
        $or:[{procesoMaltrato:true,investigadorAsignado:new Types.ObjectId(investigadorId)},{procesoMaltrato:{$ne:true},registradoPor:new Types.ObjectId(investigadorId)}],

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

    const registro=await this.casoModel.findById(casoId);
    if(registro?.procesoMaltrato)return this.entregar(casoId,{userId:investigadorId,role:UserRole.INVESTIGADOR},file);

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
