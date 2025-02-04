import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, HttpException } from '@nestjs/common';
import { CasosConflictoService } from './casos-conflicto.service';
import { CreateCasosConflictoDto } from './dto/create-casos-conflicto.dto';
import { UpdateCasosConflictoDto } from './dto/update-casos-conflicto.dto';

@Controller('conflictos')
export class CasosConflictoController {

  constructor(private readonly casosConflictoService: CasosConflictoService) {}

  @Post('crear-conflicto')
async create(@Body() createCasosConflictoDto: CreateCasosConflictoDto) {
  try {
    const nuevoCaso = await this.casosConflictoService.create(createCasosConflictoDto);
    return {
      success: true,
      message: 'Caso registrado exitosamente',
      data: nuevoCaso,
    };
  } catch (error) {
    console.error('Error al registrar el caso:', error.message);
    throw new HttpException(
      {
        success: false,
        message: 'Error al registrar el caso',
        error: error.message,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
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
