import { CreateHistoricoAlertaDto } from './dto/create-historico-alerta.dto';
import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Req,
  Res,
  ParseFilePipeBuilder
} from '@nestjs/common';

import {
  FileInterceptor,
  FilesInterceptor
} from '@nestjs/platform-express';

import { CasosAlertaService } from './casos-alerta.service';
import { CreateCasosAlertaDto } from './dto/create-casos-alerta.dto';
import { UpdateCasosAlertaDto } from './dto/update-casos-alerta.dto';

import { CasosAlerta } from './entities/casos-alerta.entity';

import { JwtAuthGuard } from 'src/auth/Guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/Guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/auth/enums/user-role.enum';

import { RechazarRegistroDto } from 'src/common/dto/rechazar-registro.dto';
import { RegistroInicialAlertaDto, CompletarAlertaDto } from './dto/gestion-alerta.dto';
import { Response } from 'express';
@UseGuards(JwtAuthGuard)
@Controller('alertas')
export class CasosAlertaController {

  // Recibe el servicio de Alerta que valida y ejecuta las operaciones de los expedientes.
  constructor(
    private readonly casosAlertaService: CasosAlertaService
  ) {}

  // Permite al analista abrir y asignar un expediente de Alerta con los datos iniciales, usando
  // la identidad de la sesión.
  @Post('registro-inicial')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  registrarInicial(@Body() dto: RegistroInicialAlertaDto, @Req() req: any) {
    return this.casosAlertaService.registrarInicial(dto,req.user);
  }

  // Lista los registros de Alerta visibles para el analista o los asignados al investigador
  // conectado.
  @Get('gestion')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA,UserRole.INVESTIGADOR)
  gestion(@Req() req: any) { return this.casosAlertaService.gestion(req.user); }

  // Solicita el detalle del expediente de Alerta y delega la comprobación de acceso según el
  // usuario autenticado.
  @Get('gestion/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA,UserRole.INVESTIGADOR)
  detalleGestion(@Param('id') id: string,@Req() req: any) { return this.casosAlertaService.detalleGestion(id,req.user); }

  // Envía los avances del expediente de Alerta al servicio para que los guarde únicamente el
  // investigador asignado.
  @Patch('gestion/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVESTIGADOR)
  completar(@Param('id') id: string,@Body() dto: CompletarAlertaDto,@Req() req: any) {
    return this.casosAlertaService.completar(id,dto,req.user);
  }

  // Recibe el PDF obligatorio del expediente de Alerta y solicita su entrega a revisión por el
  // investigador autenticado.
  @Post('gestion/:id/entregar')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVESTIGADOR)
  @UseInterceptors(FileInterceptor('file'))
  entregar(@Param('id') id: string,@Req() req: any,
    @UploadedFile(new ParseFilePipeBuilder().addFileTypeValidator({fileType:'application/pdf'}).build({fileIsRequired:true})) file: Express.Multer.File) {
    return this.casosAlertaService.entregar(id,req.user,file);
  }

  // Genera la base Excel de Alerta para el analista y envía el archivo con sus cabeceras de
  // descarga.
  @Get('exportar-excel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  async exportarExcel(@Res() res: Response) {
    const archivo=await this.casosAlertaService.exportarExcel();
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename="base-alertas.xlsx"');
    res.send(archivo);
  }


  // ─────────────────────────────────────────────
  // CREAR ALERTA
  // Apertura normal por analista sin documentos; los históricos conservan su ruta.
  // ─────────────────────────────────────────────

  // Recibe los datos históricos de Alerta y el PDF opcional para incorporarlos con la identidad
  // del usuario autorizado.
  @Post('historico')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA, UserRole.INVESTIGADOR)
  @UseInterceptors(FileInterceptor('file'))
  async incorporarHistorico(
    @Body() dto: CreateHistoricoAlertaDto,
    @Req() req: any,
    @UploadedFile(new ParseFilePipeBuilder()
      .addFileTypeValidator({ fileType: 'application/pdf' })
      .build({ fileIsRequired: false })) file?: Express.Multer.File,
  ) {
    return this.casosAlertaService.incorporarHistorico(dto, req.user, file);
  }

  // Abre el registro inicial de Alerta por el analista y rechaza archivos, porque el
  // investigador entrega el expediente posteriormente.
  @Post('crear-alerta')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ANALISTA
  )
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body() createCasosAlertaDto: RegistroInicialAlertaDto,

    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: 'application/pdf'
        })
        .build({
          fileIsRequired: false
        })
    )
    file: Express.Multer.File,

    @Req() req: any
  ) {

    if(file) throw new BadRequestException('El registro inicial no admite archivos. El investigador entrega el expediente después.');
    return this.casosAlertaService.registrarInicial(createCasosAlertaDto,req.user);
  }


  // ─────────────────────────────────────────────
  // PENDIENTES DE AUTORIZACIÓN
  // Solo Analista
  // ─────────────────────────────────────────────

  // Devuelve los expedientes de Alerta que el analista puede revisar mediante la ruta protegida
  // para ese rol.
  @Get('pendientes-autorizacion')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  async findPendientes() {

    return this.casosAlertaService.findPendientes();
  }


  // ─────────────────────────────────────────────
  // MIS REGISTROS
  // Solo Investigador
  // ─────────────────────────────────────────────

  // Consulta los registros de Alerta correspondientes al investigador autenticado, usando su ID
  // de sesión.
  @Get('mis-registros')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVESTIGADOR)
  async findMisRegistros(
    @Req() req: any
  ) {

    return this.casosAlertaService.findMisRegistros(
      req.user.userId
    );
  }


  // ─────────────────────────────────────────────
  // APROBAR REGISTRO
  // Solo Analista
  // ─────────────────────────────────────────────

  // Solicita aprobar el expediente de Alerta y registra como revisor al analista autenticado.
  @Patch(':id/aprobar-registro')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  async aprobarRegistro(
    @Param('id') id: string,
    @Req() req: any
  ) {

    return this.casosAlertaService.aprobarRegistro(
      id,
      req.user.userId
    );
  }


  // ─────────────────────────────────────────────
  // RECHAZAR REGISTRO
  // Solo Analista
  // ─────────────────────────────────────────────

  // Solicita rechazar el expediente de Alerta con el motivo recibido y la identidad del analista
  // que decide.
  @Patch(':id/rechazar-registro')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  async rechazarRegistro(
    @Param('id') id: string,
    @Body() dto: RechazarRegistroDto,
    @Req() req: any
  ) {

    return this.casosAlertaService.rechazarRegistro(
      id,
      req.user.userId,
      dto.motivo
    );
  }


  // ─────────────────────────────────────────────
  // REENVIAR DOCUMENTO CORREGIDO
  // Solo Investigador
  // PDF obligatorio
  // ─────────────────────────────────────────────

  // Recibe el PDF corregido y solicita reenviar el expediente de Alerta con la identidad del
  // investigador conectado.
  @Patch(':id/reenviar-registro')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVESTIGADOR)
  @UseInterceptors(FileInterceptor('file'))
  async reenviarRegistro(
    @Param('id') id: string,

    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: 'application/pdf'
        })
        .build({
          fileIsRequired: true
        })
    )
    file: Express.Multer.File,

    @Req() req: any
  ) {

    return this.casosAlertaService.reenviarRegistro(
      id,
      req.user.userId,
      file
    );
  }


  // ─────────────────────────────────────────────
  // LISTADO GENERAL
  // ─────────────────────────────────────────────

  // Entrega el listado de expedientes de Alerta obtenido por el servicio.
  @Get()
  async findAll(): Promise<CasosAlerta[]> {

    return this.casosAlertaService.findAll();
  }


  // ─────────────────────────────────────────────
  // BUSCAR POR NÚMERO MP
  // ─────────────────────────────────────────────

  // Exige el número MP de consulta y devuelve los expedientes de Alerta que coinciden.
  @Get('por-expedienteMP')
  async buscarPorNumeroMp(
    @Query('numeroMp') numeroMp: string
  ): Promise<CasosAlerta[]> {

    if (!numeroMp) {
      throw new NotFoundException(
        'El número de expediente MP es requerido.'
      );
    }

    return this.casosAlertaService.buscarPorNumeroMp(
      numeroMp
    );
  }


  // ─────────────────────────────────────────────
  // BUSCAR POR DEIC
  // ─────────────────────────────────────────────

  // Consulta el expediente de Alerta identificado por el número DEIC de la petición.
  @Get('by-deic/:numeroDeic')
  async buscarPorNumeroDeic(
    @Param('numeroDeic') numeroDeic: string
  ) {

    return this.casosAlertaService.buscarPorNumeroDeic(
      numeroDeic
    );
  }


  // ─────────────────────────────────────────────
  // SEGUIMIENTO
  // ─────────────────────────────────────────────

  // Recibe los datos y archivos del seguimiento de Alerta y delega su validación y registro con
  // la identidad autenticada.
  @Patch('seguimiento/:numeroDeic')
  @UseInterceptors(
    FilesInterceptor('files')
  )
  async actualizarCasoAlerta(
    @Param('numeroDeic') numeroDeic: string,
    @Body() dto: UpdateCasosAlertaDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any
  ) {

    return this.casosAlertaService
      .actualizarCasoConSeguimiento(
        numeroDeic,
        dto,
        files,
        req.user
      );
  }
}
