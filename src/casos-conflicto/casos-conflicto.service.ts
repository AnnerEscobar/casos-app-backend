import { Injectable } from '@nestjs/common';
import { CreateCasosConflictoDto } from './dto/create-casos-conflicto.dto';
import { UpdateCasosConflictoDto } from './dto/update-casos-conflicto.dto';
import { InjectModel } from '@nestjs/mongoose';
import { CasosConflicto, CasosConflictoDocument } from './entities/casos-conflicto.entity';
import { Model } from 'mongoose';

@Injectable()
export class CasosConflictoService {

  constructor(
    @InjectModel(CasosConflicto.name) private readonly casoModel: Model<CasosConflictoDocument>,
  ) {}

  async create(createCasosConflictoDto: CreateCasosConflictoDto): Promise<CasosConflicto> {
    const nuevoCaso = new this.casoModel(createCasosConflictoDto);
    return nuevoCaso.save();
  }



  //metodos sin implementar
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
