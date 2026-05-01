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

  constructor(
  private readonly informesService: InformesService,
  private readonly informeWordService: InformeWordService
) {}

  @Post()
  crear(@Body() dto: CreateInformeDto) {
    return this.informesService.crear(dto);
  }

  @Get()
  obtenerTodos() {
    return this.informesService.obtenerTodos();
  }

  @Get('pendientes')
  obtenerPendientes() {
    return this.informesService.obtenerPendientes();
  }

  @Get(':numeroDeic')
  obtenerPorDeic(@Param('numeroDeic') numeroDeic: string) {
    return this.informesService.obtenerPorDeic(numeroDeic);
  }

  @Patch(':numeroDeic/seccion')
  actualizarSeccion(
    @Param('numeroDeic') numeroDeic: string,
    @Body() dto: UpdateInformeDto
  ) {
    return this.informesService.actualizarSeccion(numeroDeic, dto);
  }

  @Patch(':numeroDeic/pendiente-registro')
  marcarPendiente(@Param('numeroDeic') numeroDeic: string) {
    return this.informesService.marcarPendienteRegistro(numeroDeic);
  }

  @Patch(':numeroDeic/registrar')
  @UseInterceptors(FileInterceptor('pdf'))
  registrarConPdf(
    @Param('numeroDeic') numeroDeic: string,
    @UploadedFile() pdf: Express.Multer.File,
    @Body() dto: UpdateInformeDto
  ) {
    return this.informesService.registrarConPdf(numeroDeic, pdf, dto);
  }

  @Patch(':numeroDeic/ampliacion')
  @UseInterceptors(FileInterceptor('file'))
  agregarAmpliacion(
    @Param('numeroDeic') numeroDeic: string,
    @Body('descripcion') descripcion: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.informesService.agregarAmpliacion(numeroDeic, descripcion, file);
  }

  @Delete(':numeroDeic')
  eliminar(@Param('numeroDeic') numeroDeic: string) {
    return this.informesService.eliminar(numeroDeic);
  }


  // Nuevo endpoint:
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