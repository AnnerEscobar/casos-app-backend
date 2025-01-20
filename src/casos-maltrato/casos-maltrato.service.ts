import { Injectable } from '@nestjs/common';
import { CreateCasosMaltratoDto } from './dto/create-casos-maltrato.dto';
import { UpdateCasosMaltratoDto } from './dto/update-casos-maltrato.dto';

@Injectable()
export class CasosMaltratoService {
  create(createCasosMaltratoDto: CreateCasosMaltratoDto) {
    return 'This action adds a new casosMaltrato';
  }

  findAll() {
    return `This action returns all casosMaltrato`;
  }

  findOne(id: number) {
    return `This action returns a #${id} casosMaltrato`;
  }

  update(id: number, updateCasosMaltratoDto: UpdateCasosMaltratoDto) {
    return `This action updates a #${id} casosMaltrato`;
  }

  remove(id: number) {
    return `This action removes a #${id} casosMaltrato`;
  }
}
