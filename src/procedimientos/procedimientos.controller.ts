import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProcedimientosService } from './procedimientos.service';
import { CreateProcedimientoDto } from './dto/create-procedimiento.dto';
import { UpdateProcedimientoDto } from './dto/update-procedimiento.dto';

@Controller('procedimientos')
export class ProcedimientosController {
  constructor(private readonly procedimientosService: ProcedimientosService) {}

  @Post()
  create(@Body() createProcedimientoDto: CreateProcedimientoDto) {
    return this.procedimientosService.create(createProcedimientoDto);
  }

  @Get()
  findAll() {
    return this.procedimientosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.procedimientosService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProcedimientoDto: UpdateProcedimientoDto) {
    return this.procedimientosService.update(+id, updateProcedimientoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.procedimientosService.remove(+id);
  }
}
