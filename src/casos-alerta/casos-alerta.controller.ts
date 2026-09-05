import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  NotFoundException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Req,
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
@UseGuards(JwtAuthGuard)
@Controller('alertas')
export class CasosAlertaController {

  constructor(
    private readonly casosAlertaService: CasosAlertaService
  ) {}


  // ─────────────────────────────────────────────
  // CREAR ALERTA
  // Solo Analista / Investigador
  // PDF obligatorio
  // ─────────────────────────────────────────────

  @Post('crear-alerta')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ANALISTA,
    UserRole.INVESTIGADOR
  )
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body() createCasosAlertaDto: CreateCasosAlertaDto,

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

    return this.casosAlertaService.create(
      createCasosAlertaDto,
      file,
      req.user
    );
  }


  // ─────────────────────────────────────────────
  // PENDIENTES DE AUTORIZACIÓN
  // Solo Analista
  // ─────────────────────────────────────────────

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

  @Get()
  async findAll(): Promise<CasosAlerta[]> {

    return this.casosAlertaService.findAll();
  }


  // ─────────────────────────────────────────────
  // BUSCAR POR NÚMERO MP
  // ─────────────────────────────────────────────

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

  @Patch('seguimiento/:numeroDeic')
  @UseInterceptors(
    FilesInterceptor('files')
  )
  async actualizarCasoAlerta(
    @Param('numeroDeic') numeroDeic: string,
    @Body() dto: UpdateCasosAlertaDto,
    @UploadedFiles() files: Express.Multer.File[]
  ) {

    return this.casosAlertaService
      .actualizarCasoConSeguimiento(
        numeroDeic,
        dto,
        files
      );
  }
}
