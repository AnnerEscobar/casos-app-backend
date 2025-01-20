import { Injectable } from '@nestjs/common';
import { CreateCasosConflictoDto } from './dto/create-casos-conflicto.dto';
import { UpdateCasosConflictoDto } from './dto/update-casos-conflicto.dto';

@Injectable()
export class CasosConflictoService {
  create(createCasosConflictoDto: CreateCasosConflictoDto) {
    return 'This action adds a new casosConflicto';
  }

  findAll() {
    return `This action returns all casosConflicto`;
  }

  findOne(id: number) {
    return `This action returns a #${id} casosConflicto`;
  }

  update(id: number, updateCasosConflictoDto: UpdateCasosConflictoDto) {
    return `This action updates a #${id} casosConflicto`;
  }

  remove(id: number) {
    return `This action removes a #${id} casosConflicto`;
  }
}
