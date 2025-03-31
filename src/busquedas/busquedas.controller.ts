import { Controller, Get, Post, Body, Param, Delete, Query, NotFoundException, Res } from '@nestjs/common';
import { BusquedasService } from './busquedas.service';
import { CreateBusquedaDto } from './dto/create-busqueda.dto';
import { Response } from 'express'; // Importar Response desde express

@Controller('busquedas')
export class BusquedasController {
  constructor(private readonly busquedasService: BusquedasService) {}

  @Get('por-expedienteMp')
  async buscarPorExpedienteMP(@Query('numeroMp') numeroMp: string) {
    if (!numeroMp) {
      throw new NotFoundException('El número de expediente MP es requerido.');
    }
    return this.busquedasService.buscarPorExpedienteMP(numeroMp);
  }

  @Get('por-numero-deic')
async buscarPorNumeroDeic(@Query('numeroDeic') numeroDeic: string) {
  if (!numeroDeic) {
    throw new NotFoundException('El número DEIC es requerido.');
  }
  return this.busquedasService.buscarPorNumeroDeic(numeroDeic);
}

@Get('por-numero-alerta')
async buscarPorNumeroAlerta(@Query('numeroAlerta') numeroAlerta: string) {
  if (!numeroAlerta) {
    throw new NotFoundException('El número de alerta es requerido.');
  }
  return this.busquedasService.buscarPorAlertaAlbaKeneth(numeroAlerta);
}

@Get('por-nombre') // Ruta relativa: /busquedas/por-nombre
async buscarPorNombre(@Query('nombre') nombre: string) {
  if (!nombre) {
    throw new NotFoundException('El nombre es requerido.');
  }
  return this.busquedasService.buscarPorNombre(nombre);
}












  @Post()
  create(@Body() createBusquedaDto: CreateBusquedaDto) {
    return this.busquedasService.create(createBusquedaDto);
  }

  @Get()
  findAll() {
    return this.busquedasService.findAll();
  }


  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.busquedasService.remove(+id);
  }
}
