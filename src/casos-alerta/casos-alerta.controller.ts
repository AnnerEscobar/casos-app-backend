import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { CasosAlertaService } from './casos-alerta.service';
import { CreateCasosAlertaDto } from './dto/create-casos-alerta.dto';
import { UpdateCasosAlertaDto } from './dto/update-casos-alerta.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

@Controller('alertas')
export class CasosAlertaController {

  constructor(private readonly casosAlertaService: CasosAlertaService) { }


  @Post('crear-alerta')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: CreateCasosAlertaDto
  })
  async createCaso(
    @Body() createCasosAlerta: CreateCasosAlertaDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.casosAlertaService.createAlerta(createCasosAlerta, file);
  }




  //casos creados automaticamente por el framework

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
