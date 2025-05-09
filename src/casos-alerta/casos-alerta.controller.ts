import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, Query, NotFoundException, UseGuards, UploadedFiles } from '@nestjs/common';
import { CasosAlertaService } from './casos-alerta.service';
import { CreateCasosAlertaDto } from './dto/create-casos-alerta.dto';
import { UpdateCasosAlertaDto } from './dto/update-casos-alerta.dto';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { CasosAlerta } from './entities/casos-alerta.entity';
import { JwtAuthGuard } from 'src/auth/Guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('alertas')
export class CasosAlertaController {

  constructor(private readonly casosAlertaService: CasosAlertaService) { }


  @Post('crear-alerta')
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body() createCasosAlertaDto: CreateCasosAlertaDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.casosAlertaService.create(createCasosAlertaDto, file)
  }

  @Get()
  async findAll(): Promise<CasosAlerta[]> {
    return this.casosAlertaService.findAll();
  }

  // Buscar alertas por número de expediente MP
  @Get('por-expedienteMP')
  async buscarPorNumeroMp(@Query('numeroMp') numeroMp: string): Promise<CasosAlerta[]> {
    if (!numeroMp) {
      throw new NotFoundException('El número de expediente MP es requerido.');
    }
    return this.casosAlertaService.buscarPorNumeroMp(numeroMp);
  }


  //endpoing para agregar un seguimiento a un caso de alerta
  @Patch('seguimiento/:numeroDeic')
  @UseInterceptors(FilesInterceptor('files'))
  async actualizarCasoAlerta(
    @Param('numeroDeic') numeroDeic: string,
    @Body() dto: UpdateCasosAlertaDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.casosAlertaService.actualizarCasoConSeguimiento(numeroDeic, dto, files);
  }


  @Get('by-deic/:numeroDeic')
  async buscarPorNumeroDeic(@Param('numeroDeic') numeroDeic: string) {
    return this.casosAlertaService.buscarPorNumeroDeic(numeroDeic);
  }




  //metodos no utilizados

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
