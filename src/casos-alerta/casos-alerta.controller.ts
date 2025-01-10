import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CasosAlertaService } from './casos-alerta.service';
import { CreateCasosAlertaDto } from './dto/create-casos-alerta.dto';
import { UpdateCasosAlertaDto } from './dto/update-casos-alerta.dto';

@Controller('casos-alerta')
export class CasosAlertaController {
  constructor(private readonly casosAlertaService: CasosAlertaService) {}

  @Post()
  create(@Body() createCasosAlertaDto: CreateCasosAlertaDto) {
    return this.casosAlertaService.create(createCasosAlertaDto);
  }

  @Get()
  findAll() {
    return this.casosAlertaService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.casosAlertaService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCasosAlertaDto: UpdateCasosAlertaDto) {
    return this.casosAlertaService.update(+id, updateCasosAlertaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.casosAlertaService.remove(+id);
  }
}
