import { RegistroInicialConflictoDto, CompletarConflictoDto } from './dto/gestion-conflicto.dto';
import { Response } from 'express';
import { CreateHistoricoConflictoDto } from './dto/create-historico-conflicto.dto';
import { SeguimientoDto } from '../common/dto/seguimiento.dto';
import {
  Res,
  BadRequestException,
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
  // Recibe el servicio de Conflicto que valida y ejecuta las operaciones de los expedientes.
  constructor(private readonly casosConflictoService: CasosConflictoService) {}

  // ─────────────────────────────────────────────
  // CREAR CASO DE CONFLICTO
  // Analista / Investigador
  // ─────────────────────────────────────────────

  // Permite al analista abrir y asignar un expediente de Conflicto con los datos iniciales,
  // usando la identidad de la sesión.
  @Post('registro-inicial')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  registrarInicial(@Body() dto: RegistroInicialConflictoDto, @Req() req: any) {
    return this.casosConflictoService.registrarInicial(dto,req.user);
  }

  // Lista los registros de Conflicto visibles para el analista o los asignados al investigador
  // conectado.
  @Get('gestion')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA,UserRole.INVESTIGADOR)
  gestion(@Req() req: any) { return this.casosConflictoService.gestion(req.user); }

  // Solicita el detalle del expediente de Conflicto y delega la comprobación de acceso según el
  // usuario autenticado.
  @Get('gestion/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA,UserRole.INVESTIGADOR)
  detalleGestion(@Param('id') id: string,@Req() req: any) { return this.casosConflictoService.detalleGestion(id,req.user); }

  // Envía los avances del expediente de Conflicto al servicio para que los guarde únicamente el
  // investigador asignado.
  @Patch('gestion/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVESTIGADOR)
  completar(@Param('id') id: string,@Body() dto: CompletarConflictoDto,@Req() req: any) {
    return this.casosConflictoService.completar(id,dto,req.user);
  }

  // Recibe el PDF obligatorio del expediente de Conflicto y solicita su entrega a revisión por
  // el investigador autenticado.
  @Post('gestion/:id/entregar')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVESTIGADOR)
  @UseInterceptors(FileInterceptor('file'))
  entregar(@Param('id') id: string,@Req() req: any,
    @UploadedFile(new ParseFilePipeBuilder().addFileTypeValidator({fileType:'application/pdf'}).build({fileIsRequired:true})) file: Express.Multer.File) {
    return this.casosConflictoService.entregar(id,req.user,file);
  }

  // Genera la base Excel de Conflicto para el analista y envía el archivo con sus cabeceras de
  // descarga.
  @Get('exportar-excel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  async exportarExcel(@Res() res: Response) {
    const archivo=await this.casosConflictoService.exportarExcel();
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename="base-conflicto.xlsx"');
    res.send(archivo);
  }


  // Recibe los datos históricos de Conflicto y el PDF opcional para incorporarlos con la
  // identidad del usuario autorizado.
  @Post('historico')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA, UserRole.INVESTIGADOR)
  @UseInterceptors(FileInterceptor('file'))
  async incorporarHistorico(
    @Body() dto: CreateHistoricoConflictoDto,
    @Req() req: any,
    @UploadedFile(new ParseFilePipeBuilder()
      .addFileTypeValidator({ fileType: 'application/pdf' })
      .build({ fileIsRequired: false })) file?: Express.Multer.File,
  ) {
    return this.casosConflictoService.incorporarHistorico(dto, req.user, file);
  }

  // Abre el registro inicial de Conflicto por el analista y rechaza archivos, porque el
  // expediente se entrega posteriormente.
  @Post('crear-conflicto')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  @UseInterceptors(FileInterceptor('file'))
  crearInicial(@Body() dto:RegistroInicialConflictoDto,@Req() req:any,@UploadedFile() file?:Express.Multer.File){
    if(file)throw new BadRequestException('El registro inicial solo admite datos, sin archivos.');
    return this.casosConflictoService.registrarInicial(dto,req.user);
  }

  // Entrega el listado de expedientes de Conflicto obtenido por el servicio.
  @Get()
  async findAll(@Req() req: any): Promise<CasosConflictoDocument[]> {
    return this.casosConflictoService.findAll(req.user);
  }

  // Consulta los registros de Conflicto correspondientes al investigador autenticado, usando su
  // ID de sesión.
  @Get('mis-registros')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVESTIGADOR)
  findMisRegistros(@Req() req: any) {
    return this.casosConflictoService.findMisRegistros(req.user.userId);
  }

  // Devuelve los expedientes de Conflicto que el analista puede revisar mediante la ruta
  // protegida para ese rol.
  @Get('pendientes-autorizacion')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  findPendientes() {
    return this.casosConflictoService.findPendientes();
  }

  // Solicita aprobar el expediente de Conflicto y registra como revisor al analista autenticado.
  @Patch(':id/aprobar-registro')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  aprobarRegistro(@Param('id') id: string, @Req() req: any) {
    return this.casosConflictoService.aprobarRegistro(id, req.user.userId);
  }

  // Solicita rechazar el expediente de Conflicto con el motivo recibido y la identidad del
  // analista que decide.
  @Patch(':id/rechazar-registro')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  rechazarRegistro(@Param('id') id: string, @Body() dto: RechazarRegistroDto, @Req() req: any) {
    return this.casosConflictoService.rechazarRegistro(id, req.user.userId, dto.motivo);
  }

  // Recibe el PDF corregido y solicita reenviar el expediente de Conflicto con la identidad del
  // investigador conectado.
  @Patch(':id/reenviar-registro')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVESTIGADOR)
  @UseInterceptors(FileInterceptor('file'))
  reenviarRegistro(@Param('id') id: string, @Req() req: any,
    @UploadedFile(new ParseFilePipeBuilder().addFileTypeValidator({ fileType: 'application/pdf' }).build({ fileIsRequired: true })) file: Express.Multer.File) {
    return this.casosConflictoService.reenviarRegistro(id, req.user.userId, file);
  }

  // Consulta el caso aprobado con la misma política de acceso que Búsquedas.
  @Get('buscar/:numeroDeic')
  buscarPorNumeroDeic(@Param('numeroDeic') numeroDeic: string, @Req() req: any) {
    return this.casosConflictoService.buscarPorNumeroDeic(numeroDeic, req.user);
  }

  // Exige un PDF real y valida la autorización antes de subirlo o guardar la actuación.
  @Patch('seguimiento/:numeroDeic')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA, UserRole.INVESTIGADOR)
  @UseInterceptors(FileInterceptor('file'))
  agregarSeguimiento(@Param('numeroDeic') numeroDeic: string, @Body() dto: SeguimientoDto,
    @UploadedFile(new ParseFilePipeBuilder().addFileTypeValidator({ fileType: 'application/pdf' }).build({ fileIsRequired: true })) file: Express.Multer.File,
    @Req() req: any) {
    return this.casosConflictoService.agregarSeguimiento(numeroDeic, dto.estadoInvestigacion, file, req.user, dto.investigadorAsignado);
  }

  // Delega en la consulta provisional por ID de Conflicto; todavía devuelve un mensaje de
  // ejemplo.
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.casosConflictoService.findOne(+id);
  }

  // Delega en la actualización provisional por ID de Conflicto, que todavía no modifica
  // documentos.
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCasosConflictoDto: UpdateCasosConflictoDto,
  ) {
    return this.casosConflictoService.update(+id, updateCasosConflictoDto);
  }

  // Delega en el método provisional de eliminación de Conflicto; ese método no borra expedientes
  // de la base.
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.casosConflictoService.remove(+id);
  }
}
