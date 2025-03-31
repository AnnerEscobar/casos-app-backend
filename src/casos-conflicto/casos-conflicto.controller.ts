import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, HttpException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { CasosConflictoService } from './casos-conflicto.service';
import { CreateCasosConflictoDto } from './dto/create-casos-conflicto.dto';
import { UpdateCasosConflictoDto } from './dto/update-casos-conflicto.dto';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { CasosConflictoDocument } from './entities/casos-conflicto.entity';

@Controller('conflictos')
export class CasosConflictoController {

  constructor(private readonly casosConflictoService: CasosConflictoService) { }

  @Post('crear-conflicto')
  @UseInterceptors(FileInterceptor('file')) // 📌 Maneja la subida de un solo archivo
  async create(
    @Body() createCasosConflictoDto: CreateCasosConflictoDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.casosConflictoService.create(createCasosConflictoDto, file);
  }


  @Get()
  async findAll(): Promise<CasosConflictoDocument[]> {
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
