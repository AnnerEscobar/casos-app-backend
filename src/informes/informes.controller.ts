import { Controller, Get, Post, Patch, Delete, Body, Param, UploadedFile, UseInterceptors, UseGuards, Res } from '@nestjs/common';
import { InformesService } from './informes.service';
import { CreateInformeDto } from './dto/create-informe.dto';
import { UpdateInformeDto } from './dto/update-informe.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/Guards/jwt-auth.guard';
import { Response } from 'express';
import { InformeWordService } from './informe-word.service';

@UseGuards(JwtAuthGuard)
@Controller('informes')
export class InformesController {

  // Recibe los servicios de informes y generación Word para administrar el contenido y descargar
  // el documento.
  constructor(
  private readonly informesService: InformesService,
  private readonly informeWordService: InformeWordService
) {}

  // Recibe los datos iniciales del informe y delega su creación y validación al servicio.
  @Post()
  crear(@Body() dto: CreateInformeDto) {
    return this.informesService.crear(dto);
  }

  // Devuelve los informes almacenados mediante el servicio.
  @Get()
  obtenerTodos() {
    return this.informesService.obtenerTodos();
  }

  // Consulta los informes marcados como pendientes de registro.
  @Get('pendientes')
  obtenerPendientes() {
    return this.informesService.obtenerPendientes();
  }

  // Obtiene el informe identificado por el número DEIC de la ruta.
  @Get(':numeroDeic')
  obtenerPorDeic(@Param('numeroDeic') numeroDeic: string) {
    return this.informesService.obtenerPorDeic(numeroDeic);
  }

  // Envía los campos recibidos para actualizar las secciones del informe conservando la
  // información existente.
  @Patch(':numeroDeic/seccion')
  actualizarSeccion(
    @Param('numeroDeic') numeroDeic: string,
    @Body() dto: UpdateInformeDto
  ) {
    return this.informesService.actualizarSeccion(numeroDeic, dto);
  }

  // Solicita pasar el informe al estado pendiente de registro.
  @Patch(':numeroDeic/pendiente-registro')
  marcarPendiente(@Param('numeroDeic') numeroDeic: string) {
    return this.informesService.marcarPendienteRegistro(numeroDeic);
  }

  // Recibe el PDF del informe y solicita registrar su entrega con los datos del expediente.
  @Patch(':numeroDeic/registrar')
  @UseInterceptors(FileInterceptor('pdf'))
  registrarConPdf(
    @Param('numeroDeic') numeroDeic: string,
    @UploadedFile() pdf: Express.Multer.File,
    @Body() dto: UpdateInformeDto
  ) {
    return this.informesService.registrarConPdf(numeroDeic, pdf, dto);
  }

  // Recibe los datos y el archivo opcional de una ampliación para incorporarlos al informe
  // existente.
  @Patch(':numeroDeic/ampliacion')
  @UseInterceptors(FileInterceptor('file'))
  agregarAmpliacion(
    @Param('numeroDeic') numeroDeic: string,
    @Body('descripcion') descripcion: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.informesService.agregarAmpliacion(numeroDeic, descripcion, file);
  }

  // Solicita eliminar el informe identificado por DEIC y devuelve la respuesta del servicio.
  @Delete(':numeroDeic')
  eliminar(@Param('numeroDeic') numeroDeic: string) {
    return this.informesService.eliminar(numeroDeic);
  }


  // Nuevo endpoint:
// Carga el informe, genera su documento Word y lo envía con las cabeceras de descarga
// correspondientes.
@Get(':numeroDeic/descargar-word')
async descargarWord(
  @Param('numeroDeic') numeroDeic: string,
  @Res() res: Response
) {
  const informe = await this.informesService.obtenerPorDeic(numeroDeic);
  const buffer = await this.informeWordService.generarWord(informe as any);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="INFORME-${numeroDeic}.docx"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}
}