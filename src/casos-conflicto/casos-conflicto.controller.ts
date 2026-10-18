import { RegistroInicialConflictoDto, CompletarConflictoDto } from './dto/gestion-conflicto.dto';
import { Response } from 'express';
import { CreateHistoricoConflictoDto } from './dto/create-historico-conflicto.dto';
import { SeguimientoDto } from '../common/dto/seguimiento.dto';
import {
  Res,
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { CasosConflictoService } from './casos-conflicto.service';

import { CreateCasosConflictoDto } from './dto/create-casos-conflicto.dto';

import { UpdateCasosConflictoDto } from './dto/update-casos-conflicto.dto';

import { CasosConflictoDocument } from './entities/casos-conflicto.entity';

import { JwtAuthGuard } from 'src/auth/Guards/jwt-auth.guard';

import { RolesGuard } from 'src/auth/Guards/roles.guard';

import { Roles } from 'src/auth/decorators/roles.decorator';

import { UserRole } from 'src/auth/enums/user-role.enum';

import { RechazarRegistroDto } from 'src/common/dto/rechazar-registro.dto';

@UseGuards(JwtAuthGuard)
@Controller('conflictos')
export class CasosConflictoController {
  constructor(private readonly casosConflictoService: CasosConflictoService) {}

  // ─────────────────────────────────────────────
  // CREAR CASO DE CONFLICTO
  // Analista / Investigador
  // ─────────────────────────────────────────────

  @Post('registro-inicial')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  registrarInicial(@Body() dto: RegistroInicialConflictoDto, @Req() req: any) {
    return this.casosConflictoService.registrarInicial(dto,req.user);
  }

  @Get('gestion')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA,UserRole.INVESTIGADOR)
  gestion(@Req() req: any) { return this.casosConflictoService.gestion(req.user); }

  @Get('gestion/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA,UserRole.INVESTIGADOR)
  detalleGestion(@Param('id') id: string,@Req() req: any) { return this.casosConflictoService.detalleGestion(id,req.user); }

  @Patch('gestion/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVESTIGADOR)
  completar(@Param('id') id: string,@Body() dto: CompletarConflictoDto,@Req() req: any) {
    return this.casosConflictoService.completar(id,dto,req.user);
  }

  @Post('gestion/:id/entregar')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVESTIGADOR)
  @UseInterceptors(FileInterceptor('file'))
  entregar(@Param('id') id: string,@Req() req: any,
    @UploadedFile(new ParseFilePipeBuilder().addFileTypeValidator({fileType:'application/pdf'}).build({fileIsRequired:true})) file: Express.Multer.File) {
    return this.casosConflictoService.entregar(id,req.user,file);
  }

  @Get('exportar-excel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  async exportarExcel(@Res() res: Response) {
    const archivo=await this.casosConflictoService.exportarExcel();
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition','attachment; filename="base-conflicto.xlsx"');
    res.send(archivo);
  }


  @Post('historico')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA, UserRole.INVESTIGADOR)
  @UseInterceptors(FileInterceptor('file'))
  async incorporarHistorico(
    @Body() dto: CreateHistoricoConflictoDto,
    @Req() req: any,
    @UploadedFile(new ParseFilePipeBuilder()
      .addFileTypeValidator({ fileType: 'application/pdf' })
      .build({ fileIsRequired: false })) file?: Express.Multer.File,
  ) {
    return this.casosConflictoService.incorporarHistorico(dto, req.user, file);
  }

  @Post('crear-conflicto')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  @UseInterceptors(FileInterceptor('file'))
  crearInicial(@Body() dto:RegistroInicialConflictoDto,@Req() req:any,@UploadedFile() file?:Express.Multer.File){
    if(file)throw new BadRequestException('El registro inicial solo admite datos, sin archivos.');
    return this.casosConflictoService.registrarInicial(dto,req.user);
  }

  @Get()
  async findAll(): Promise<CasosConflictoDocument[]> {
    return this.casosConflictoService.findAll();
  }

  // ─────────────────────────────────────────────
  // MÉTODOS TODAVÍA NO IMPLEMENTADOS
  // ─────────────────────────────────────────────

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.casosConflictoService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCasosConflictoDto: UpdateCasosConflictoDto,
  ) {
    return this.casosConflictoService.update(+id, updateCasosConflictoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.casosConflictoService.remove(+id);
  }
}
