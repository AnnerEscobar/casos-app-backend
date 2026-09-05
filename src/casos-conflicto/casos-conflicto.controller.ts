import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { CasosConflictoService } from './casos-conflicto.service';

import { CreateCasosConflictoDto } from './dto/create-casos-conflicto.dto';

import { UpdateCasosConflictoDto } from './dto/update-casos-conflicto.dto';

import { CasosConflictoDocument } from './entities/casos-conflicto.entity';

import { JwtAuthGuard } from 'src/auth/Guards/jwt-auth.guard';

import { RolesGuard } from 'src/auth/Guards/roles.guard';

import { Roles } from 'src/auth/decorators/roles.decorator';

import { UserRole } from 'src/auth/enums/user-role.enum';

import { RechazarRegistroDto } from 'src/common/dto/rechazar-registro.dto';

@UseGuards(JwtAuthGuard)
@Controller('conflictos')
export class CasosConflictoController {
  constructor(private readonly casosConflictoService: CasosConflictoService) {}

  // ─────────────────────────────────────────────
  // CREAR CASO DE CONFLICTO
  // Analista / Investigador
  // ─────────────────────────────────────────────

  @Post('crear-conflicto')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA, UserRole.INVESTIGADOR)
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body() createCasosConflictoDto: CreateCasosConflictoDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: 'application/pdf',
        })
        .build({
          fileIsRequired: true,
        }),
    )
    file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.casosConflictoService.create(
      createCasosConflictoDto,
      file,
      req.user,
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
    return this.casosConflictoService.findPendientes();
  }

  // ─────────────────────────────────────────────
  // MIS REGISTROS
  // Solo Investigador
  // ─────────────────────────────────────────────

  @Get('mis-registros')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVESTIGADOR)
  async findMisRegistros(@Req() req: any) {
    return this.casosConflictoService.findMisRegistros(req.user.userId);
  }

  // ─────────────────────────────────────────────
  // APROBAR REGISTRO
  // Solo Analista
  // ─────────────────────────────────────────────

  @Patch(':id/aprobar-registro')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  async aprobarRegistro(@Param('id') id: string, @Req() req: any) {
    return this.casosConflictoService.aprobarRegistro(id, req.user.userId);
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
    @Req() req: any,
  ) {
    return this.casosConflictoService.rechazarRegistro(
      id,
      req.user.userId,
      dto.motivo,
    );
  }

  // ─────────────────────────────────────────────
  // REENVIAR REGISTRO CORREGIDO
  // Solo Investigador
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
          fileType: 'application/pdf',
        })
        .build({
          fileIsRequired: true,
        }),
    )
    file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.casosConflictoService.reenviarRegistro(
      id,
      req.user.userId,
      file,
    );
  }

  // ─────────────────────────────────────────────
  // AGREGAR SEGUIMIENTO
  // ─────────────────────────────────────────────

  @Patch('seguimiento/:numeroDeic')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA, UserRole.INVESTIGADOR)
  @UseInterceptors(FileInterceptor('file'))
  async actualizarSeguimiento(
    @Param('numeroDeic') numeroDeic: string,

    @Body()
    body: {
      estadoInvestigacion: string;
    },

    @UploadedFile()
    file: Express.Multer.File,
  ) {
    return this.casosConflictoService.agregarSeguimiento(
      numeroDeic,
      body.estadoInvestigacion,
      file,
    );
  }

  // ─────────────────────────────────────────────
  // BUSCAR POR DEIC
  // ─────────────────────────────────────────────

  @Get('buscar/:numeroDeic')
  async buscarPorNumeroDeic(@Param('numeroDeic') numeroDeic: string) {
    return this.casosConflictoService.buscarPorNumeroDeic(numeroDeic);
  }

  // ─────────────────────────────────────────────
  // LISTADO GENERAL
  // Solo casos aprobados + históricos
  // ─────────────────────────────────────────────

  @Get()
  async findAll(): Promise<CasosConflictoDocument[]> {
    return this.casosConflictoService.findAll();
  }

  // ─────────────────────────────────────────────
  // MÉTODOS TODAVÍA NO IMPLEMENTADOS
  // ─────────────────────────────────────────────

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.casosConflictoService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCasosConflictoDto: UpdateCasosConflictoDto,
  ) {
    return this.casosConflictoService.update(+id, updateCasosConflictoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.casosConflictoService.remove(+id);
  }
}
