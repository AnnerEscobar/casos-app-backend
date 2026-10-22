import { Injectable } from '@nestjs/common';
import { CreateProcedimientoDto } from './dto/create-procedimiento.dto';
import { UpdateProcedimientoDto } from './dto/update-procedimiento.dto';

@Injectable()
export class ProcedimientosService {
  // Devuelve el mensaje provisional de creación del módulo; todavía no persiste procedimientos.
  create(createProcedimientoDto: CreateProcedimientoDto) {
    return 'This action adds a new procedimiento';
  }

  // Devuelve el mensaje provisional de listado; todavía no consulta procedimientos en la base.
  findAll() {
    return `This action returns all procedimientos`;
  }

  // Devuelve un mensaje de ejemplo con el identificador solicitado, sin consultar un
  // procedimiento real.
  findOne(id: number) {
    return `This action returns a #${id} procedimiento`;
  }

  // Devuelve un mensaje de ejemplo con el identificador recibido, sin modificar información
  // persistida.
  update(id: number, updateProcedimientoDto: UpdateProcedimientoDto) {
    return `This action updates a #${id} procedimiento`;
  }

  // Devuelve un mensaje de ejemplo con el identificador recibido, sin borrar información
  // persistida.
  remove(id: number) {
    return `This action removes a #${id} procedimiento`;
  }
}
