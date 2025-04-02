import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, UseGuards } from '@nestjs/common';
import { CasosMaltratoService } from './casos-maltrato.service';
import { CreateCasosMaltratoDto } from './dto/create-casos-maltrato.dto';
import { UpdateCasosMaltratoDto } from './dto/update-casos-maltrato.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { CasosMaltratoDocument } from './entities/casos-maltrato.entity';
import { JwtAuthGuard } from 'src/auth/Guards/jwt-auth.guard';


@UseGuards(JwtAuthGuard)
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

  @Get()
  async findAll(): Promise<CasosMaltratoDocument[]> {
    return this.casosMaltratoService.findAll();
  }







  //casos sin implemententar


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
