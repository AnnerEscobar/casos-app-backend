import { RegistroInicialMaltratoDto, CompletarMaltratoDto } from './dto/gestion-maltrato.dto';
import { Response } from 'express';
import { CreateHistoricoMaltratoDto } from './dto/create-historico-maltrato.dto';
import { SeguimientoDto } from '../common/dto/seguimiento.dto';
import {
  BadRequestException,
  Res,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req,
  ParseFilePipeBuilder,
} from '@nestjs/common';
import { CasosMaltratoService } from './casos-maltrato.service';
import { CreateCasosMaltratoDto } from './dto/create-casos-maltrato.dto';
import { UpdateCasosMaltratoDto } from './dto/update-casos-maltrato.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { CasosMaltratoDocument } from './entities/casos-maltrato.entity';
import { JwtAuthGuard } from 'src/auth/Guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/Guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/auth/enums/user-role.enum';
import { RechazarRegistroDto } from '../common/dto/rechazar-registro.dto';

@UseGuards(JwtAuthGuard)
@Controller('maltratos')
export class CasosMaltratoController {
  // Recibe el servicio de Maltrato que valida y ejecuta las operaciones de los expedientes.
  constructor(private readonly casosMaltratoService: CasosMaltratoService) {}

  // Permite al analista abrir y asignar un expediente de Maltrato con los datos iniciales,
  // usando la identidad de la sesión.
  @Post('registro-inicial')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  registrarInicial(@Body() dto: RegistroInicialMaltratoDto, @Req() req: any) {
    return this.casosMaltratoService.registrarInicial(dto,req.user);
  }

  // Lista los registros de Maltrato visibles para el analista o los asignados al investigador
  // conectado.
  @Get('gestion')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA,UserRole.INVESTIGADOR)
  gestion(@Req() req: any) { return this.casosMaltratoService.gestion(req.user); }

  // Solicita el detalle del expediente de Maltrato y delega la comprobación de acceso según el
  // usuario autenticado.
  @Get('gestion/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA,UserRole.INVESTIGADOR)
  detalleGestion(@Param('id') id: string,@Req() req: any) { return this.casosMaltratoService.detalleGestion(id,req.user); }

  // Envía los avances del expediente de Maltrato al servicio para que los guarde únicamente el
  // investigador asignado.
  @Patch('gestion/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVESTIGADOR)
  completar(@Param('id') id: string,@Body() dto: CompletarMaltratoDto,@Req() req: any) {
    return this.casosMaltratoService.completar(id,dto,req.user);
  }

  // Recibe el PDF obligatorio del expediente de Maltrato y solicita su entrega a revisión por el
  // investigador autenticado.
  @Post('gestion/:id/entregar')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVESTIGADOR)
  @UseInterceptors(FileInterceptor('file'))
  entregar(@Param('id') id: string,@Req() req: any,
    @UploadedFile(new ParseFilePipeBuilder().addFileTypeValidator({fileType:'application/pdf'}).build({fileIsRequired:true})) file: Express.Multer.File) {
    return this.casosMaltratoService.entregar(id,req.user,file);
  }

  // Genera la base Excel de Maltrato para el analista y envía el archivo con sus cabeceras de
  // descarga.
  @Get('exportar-excel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  async exportarExcel(@Res() res: Response) {
    const archivo=await this.casosMaltratoService.exportarExcel();
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename="base-maltrato.xlsx"');
    res.send(archivo);
  }


  // ─────────────────────────────────────────────
  // REGISTRO DE MALTRATO
  // Apertura normal por analista sin documentos; los históricos conservan su ruta.
  // ─────────────────────────────────────────────

  // Recibe los datos históricos de Maltrato y el PDF opcional para incorporarlos con la
  // identidad del usuario autorizado.
  @Post('historico')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA, UserRole.INVESTIGADOR)
  @UseInterceptors(FileInterceptor('file'))
  async incorporarHistorico(
    @Body() dto: CreateHistoricoMaltratoDto,
    @Req() req: any,
    @UploadedFile(new ParseFilePipeBuilder()
      .addFileTypeValidator({ fileType: 'application/pdf' })
      .build({ fileIsRequired: false })) file?: Express.Multer.File,
  ) {
    return this.casosMaltratoService.incorporarHistorico(dto, req.user, file);
  }

  // Abre el registro inicial de Maltrato por el analista y rechaza archivos, porque el
  // expediente se entrega posteriormente.
  @Post('crear-maltrato')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  @UseInterceptors(FileInterceptor('file'))
  crearInicial(@Body() dto:RegistroInicialMaltratoDto,@Req() req:any,@UploadedFile() file?:Express.Multer.File){
    if(file)throw new BadRequestException('El registro inicial solo admite datos, sin archivos.');
    return this.casosMaltratoService.registrarInicial(dto,req.user);
  }

  // Entrega el listado de expedientes de Maltrato obtenido por el servicio.
  @Get()
  async findAll(): Promise<CasosMaltratoDocument[]> {
    return this.casosMaltratoService.findAll();
  }

  // Recibe el estado, el responsable y el PDF del seguimiento de Maltrato, y solicita guardarlos
  // con el usuario autenticado.
  @Patch('seguimiento/:numeroDeic')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA, UserRole.INVESTIGADOR)
  @UseInterceptors(FileInterceptor('file'))
  async actualizarSeguimiento(
    @Param('numeroDeic')
    numeroDeic: string,

    @Body()
    body: SeguimientoDto,

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
    return this.casosMaltratoService.agregarSeguimiento(
      numeroDeic,
      body.estadoInvestigacion,
      file,
      req.user,
      body.investigadorAsignado,
    );
  }

  // Consulta el expediente de Maltrato identificado por el número DEIC de la petición.
  @Get('buscar/:numeroDeic')
  async buscarPorNumeroDeic(@Param('numeroDeic') numeroDeic: string) {
    return this.casosMaltratoService.buscarPorNumeroDeic(numeroDeic);
  }

  // Devuelve los expedientes de Maltrato que el analista puede revisar mediante la ruta
  // protegida para ese rol.
  @Get('pendientes-autorizacion')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  async findPendientes() {
    return this.casosMaltratoService.findPendientes();
  }

  // Solicita aprobar el expediente de Maltrato y registra como revisor al analista autenticado.
  @Patch(':id/aprobar-registro')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  async aprobarRegistro(@Param('id') id: string, @Req() req: any) {
    return this.casosMaltratoService.aprobarRegistro(id, req.user.userId);
  }

  // Solicita rechazar el expediente de Maltrato con el motivo recibido y la identidad del
  // analista que decide.
  @Patch(':id/rechazar-registro')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  async rechazarRegistro(
    @Param('id') id: string,
    @Body() dto: RechazarRegistroDto,
    @Req() req: any,
  ) {
    return this.casosMaltratoService.rechazarRegistro(
      id,
      req.user.userId,
      dto.motivo,
    );
  }

  //investigador puede ver sus propios registros
  // Consulta los registros de Maltrato correspondientes al investigador autenticado, usando su
  // ID de sesión.
  @Get('mis-registros')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVESTIGADOR)
  async findMisRegistros(@Req() req: any) {
    return this.casosMaltratoService.findMisRegistros(req.user.userId);
  }

  // Recibe el PDF corregido y solicita reenviar el expediente de Maltrato con la identidad del
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
          fileType: 'application/pdf',
        })
        .build({
          fileIsRequired: true,
        }),
    )
    file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.casosMaltratoService.reenviarRegistro(
      id,
      req.user.userId,
      file,
    );
  }

  //casos sin implemententar

  // Delega en la consulta provisional por ID de Maltrato; todavía devuelve un mensaje de
  // ejemplo.
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.casosMaltratoService.findOne(+id);
  }

  // Delega en la actualización provisional por ID de Maltrato, que todavía no modifica
  // documentos.
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCasosMaltratoDto: UpdateCasosMaltratoDto,
  ) {
    return this.casosMaltratoService.update(+id, updateCasosMaltratoDto);
  }

  // Delega en el método provisional de eliminación de Maltrato; ese método no borra expedientes
  // de la base.
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.casosMaltratoService.remove(+id);
  }
}
