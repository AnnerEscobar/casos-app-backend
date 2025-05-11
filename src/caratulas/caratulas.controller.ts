import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus, Res, Query } from '@nestjs/common';
import { CaratulasService } from './caratulas.service';
import { CreateCaratulaDto } from './dto/create-caratula.dto';
import { Caratula } from './entities/caratula.entity';
import { Response } from 'express';


@Controller('caratulas')
export class CaratulasController {

  constructor(private readonly caratulasService: CaratulasService) { }

  // POST /caratulas/pendiente
  @Post('pendiente')
  async create(@Body() createDto: CreateCaratulaDto): Promise<Caratula> {
    console.log('DTO recibido:', createDto);
    return this.caratulasService.create(createDto);
  }

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
  @Delete(':numeroDeic')
  async deleteCaratula(@Param('numeroDeic') numeroDeic: string) {
    await this.caratulasService.remove(numeroDeic);
    return { message: 'Carátula eliminada correctamente' };
  }

  /*  @Post('pendiente')
   async crearPendiente(@Body() dto: CreateCaratulaDto) {
     return this.caratulasService.create(dto); // solo guarda
   } */

  @Get('pendientes/count')
  async getPendientesCount() {
    const total = await this.caratulasService.countPendientes();
    return { total };
  }

  @Post('generar')
  @HttpCode(200)
  async generarPDF(@Body() dto: CreateCaratulaDto, @Res() res: Response) {
    return this.caratulasService.generarCaratulaPDF(dto, res); // solo genera y lo manda
  }



}
