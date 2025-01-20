import { Injectable } from '@nestjs/common';
import { CreateProcedimientoDto } from './dto/create-procedimiento.dto';
import { UpdateProcedimientoDto } from './dto/update-procedimiento.dto';

@Injectable()
export class ProcedimientosService {
  create(createProcedimientoDto: CreateProcedimientoDto) {
    return 'This action adds a new procedimiento';
  }

  findAll() {
    return `This action returns all procedimientos`;
  }

  findOne(id: number) {
    return `This action returns a #${id} procedimiento`;
  }

  update(id: number, updateProcedimientoDto: UpdateProcedimientoDto) {
    return `This action updates a #${id} procedimiento`;
  }

  remove(id: number) {
    return `This action removes a #${id} procedimiento`;
  }
}
