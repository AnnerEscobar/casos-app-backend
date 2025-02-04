import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { CasosAlertaService } from './casos-alerta.service';
import { CreateCasosAlertaDto } from './dto/create-casos-alerta.dto';
import { UpdateCasosAlertaDto } from './dto/update-casos-alerta.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('alertas')
export class CasosAlertaController {

  constructor(private readonly casosAlertaService: CasosAlertaService) { }


  @Post('crear-alerta')
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body() createCasosAlertaDto: CreateCasosAlertaDto,
    @UploadedFile() file: Express.Multer.File,
  ){
    return this.casosAlertaService.create(createCasosAlertaDto, file)
  }



  //metodos no utilizados
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
