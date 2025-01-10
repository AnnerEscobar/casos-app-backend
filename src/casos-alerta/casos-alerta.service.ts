import { Injectable } from '@nestjs/common';
import { CreateCasosAlertaDto } from './dto/create-casos-alerta.dto';
import { UpdateCasosAlertaDto } from './dto/update-casos-alerta.dto';

@Injectable()
export class CasosAlertaService {
  create(createCasosAlertaDto: CreateCasosAlertaDto) {
    return 'This action adds a new casosAlerta';
  }

  findAll() {
    return `This action returns all casosAlerta`;
  }

  findOne(id: number) {
    return `This action returns a #${id} casosAlerta`;
  }

  update(id: number, updateCasosAlertaDto: UpdateCasosAlertaDto) {
    return `This action updates a #${id} casosAlerta`;
  }

  remove(id: number) {
    return `This action removes a #${id} casosAlerta`;
  }
}
