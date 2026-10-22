import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ProcedimientosService } from './procedimientos.service';
import { CreateProcedimientoDto } from './dto/create-procedimiento.dto';
import { UpdateProcedimientoDto } from './dto/update-procedimiento.dto';
import { JwtAuthGuard } from 'src/auth/Guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('procedimientos')
export class ProcedimientosController {
  // Recibe el servicio provisional de procedimientos utilizado por las rutas generadas del
  // módulo.
  constructor(private readonly procedimientosService: ProcedimientosService) {}

  // Delega la creación al método provisional del servicio; la ruta todavía no registra
  // procedimientos en la base.
  @Post()
  create(@Body() createProcedimientoDto: CreateProcedimientoDto) {
    return this.procedimientosService.create(createProcedimientoDto);
  }

  // Delega el listado al método provisional del servicio, que actualmente devuelve un mensaje de
  // ejemplo.
  @Get()
  findAll() {
    return this.procedimientosService.findAll();
  }

  // Delega la consulta del identificador al método provisional, sin recuperar todavía un
  // documento de la base.
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.procedimientosService.findOne(+id);
  }

  // Delega la actualización al método provisional, que aún no modifica procedimientos
  // persistidos.
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProcedimientoDto: UpdateProcedimientoDto) {
    return this.procedimientosService.update(+id, updateProcedimientoDto);
  }

  // Delega la eliminación al método provisional, que aún no borra procedimientos de la base.
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.procedimientosService.remove(+id);
  }
}
