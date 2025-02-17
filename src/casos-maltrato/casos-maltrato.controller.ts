import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { CasosMaltratoService } from './casos-maltrato.service';
import { CreateCasosMaltratoDto } from './dto/create-casos-maltrato.dto';
import { UpdateCasosMaltratoDto } from './dto/update-casos-maltrato.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('maltratos')
export class CasosMaltratoController {
  constructor(private readonly casosMaltratoService: CasosMaltratoService) { }

  @Post('crear-maltrato')
  @UseInterceptors(FileInterceptor('file')) // 📌 Maneja la subida de un solo archivo
  async create(
    @Body() createCasosConflictoDto: CreateCasosMaltratoDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.casosMaltratoService.create(createCasosConflictoDto, file);
  }











  //casos sin implemententar

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
