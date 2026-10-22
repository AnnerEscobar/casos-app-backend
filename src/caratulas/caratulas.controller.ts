import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus, Res, Query, UseGuards } from '@nestjs/common';
import { CaratulasService } from './caratulas.service';
import { CreateCaratulaDto } from './dto/create-caratula.dto';
import { Caratula } from './entities/caratula.entity';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/Guards/jwt-auth.guard';


@UseGuards(JwtAuthGuard)
@Controller('caratulas')
export class CaratulasController {

  // Recibe el servicio encargado de registrar carátulas, consultar pendientes y generar sus
  // archivos PDF.
  constructor(private readonly caratulasService: CaratulasService) { }

  // POST /caratulas/pendiente
  // Recibe los datos validados de la carátula y delega su registro al servicio.
  @Post('pendiente')
  async create(@Body() createDto: CreateCaratulaDto): Promise<Caratula> {
    console.log('DTO recibido:', createDto);
    return this.caratulasService.create(createDto);
  }

  // Consulta las carátulas pendientes con la página y límite solicitados para devolver una lista
  // paginada.
  @Get('pendientes')
  async getPendientes(@Query('page') page: string, @Query('limit') limit: string) {
    const pageNum = parseInt(page, 10) || 0;
    const limitNum = parseInt(limit, 10) || 10;

    const skip = pageNum * limitNum;

    const [data, total] = await Promise.all([
      this.caratulasService.findPendientesPaginated(skip, limitNum),
      this.caratulasService.countPendientes(),
    ]);

    return { data, total };
  }

  // DELETE /caratulas/pendiente/:numeroDeic
  // Solicita eliminar la carátula identificada por DEIC y devuelve la confirmación
  // correspondiente.
  @Delete(':numeroDeic')
  async deleteCaratula(@Param('numeroDeic') numeroDeic: string) {
    await this.caratulasService.remove(numeroDeic);
    return { message: 'Carátula eliminada correctamente' };
  }

  /*  @Post('pendiente')
   async crearPendiente(@Body() dto: CreateCaratulaDto) {
     return this.caratulasService.create(dto); // solo guarda
   } */

  // Devuelve la cantidad de carátulas pendientes para actualizar el indicador de la interfaz.
  @Get('pendientes/count')
  async getPendientesCount() {
    const total = await this.caratulasService.countPendientes();
    return { total };
  }

  // Genera la carátula y envía su contenido con las cabeceras necesarias para descargar el PDF.
  @Post('generar')
  @HttpCode(200)
  async generarPDF(@Body() dto: CreateCaratulaDto, @Res() res: Response) {
    return this.caratulasService.generarCaratulaPDF(dto, res); // solo genera y lo manda
  }



}
