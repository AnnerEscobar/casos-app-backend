import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CasosMaltratoService } from './casos-maltrato.service';
import { CreateCasosMaltratoDto } from './dto/create-casos-maltrato.dto';
import { UpdateCasosMaltratoDto } from './dto/update-casos-maltrato.dto';

@Controller('casos-maltrato')
export class CasosMaltratoController {
  constructor(private readonly casosMaltratoService: CasosMaltratoService) {}

  @Post()
  create(@Body() createCasosMaltratoDto: CreateCasosMaltratoDto) {
    return this.casosMaltratoService.create(createCasosMaltratoDto);
  }

  @Get()
  findAll() {
    return this.casosMaltratoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.casosMaltratoService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCasosMaltratoDto: UpdateCasosMaltratoDto) {
    return this.casosMaltratoService.update(+id, updateCasosMaltratoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.casosMaltratoService.remove(+id);
  }
}
