import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CasosConflictoService } from './casos-conflicto.service';
import { CreateCasosConflictoDto } from './dto/create-casos-conflicto.dto';
import { UpdateCasosConflictoDto } from './dto/update-casos-conflicto.dto';

@Controller('casos-conflicto')
export class CasosConflictoController {
  constructor(private readonly casosConflictoService: CasosConflictoService) {}

  @Post()
  create(@Body() createCasosConflictoDto: CreateCasosConflictoDto) {
    return this.casosConflictoService.create(createCasosConflictoDto);
  }

  @Get()
  findAll() {
    return this.casosConflictoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.casosConflictoService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCasosConflictoDto: UpdateCasosConflictoDto) {
    return this.casosConflictoService.update(+id, updateCasosConflictoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.casosConflictoService.remove(+id);
  }
}
