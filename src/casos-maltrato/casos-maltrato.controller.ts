import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req
} from '@nestjs/common';
import { CasosMaltratoService } from './casos-maltrato.service';
import { CreateCasosMaltratoDto } from './dto/create-casos-maltrato.dto';
import { UpdateCasosMaltratoDto } from './dto/update-casos-maltrato.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { CasosMaltratoDocument } from './entities/casos-maltrato.entity';
import { JwtAuthGuard } from 'src/auth/Guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/Guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/auth/enums/user-role.enum';
import { RechazarRegistroDto } from './dto/rechazar-registro.dto';



@UseGuards(JwtAuthGuard)
@Controller('maltratos')
export class CasosMaltratoController {
  constructor(private readonly casosMaltratoService: CasosMaltratoService) { }

  @Post('crear-maltrato')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ANALISTA,
    UserRole.INVESTIGADOR
  )
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body() createCasosMaltratoDto: CreateCasosMaltratoDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any
  ) {

    return this.casosMaltratoService.create(
      createCasosMaltratoDto,
      file,
      req.user
    );
  }

  @Get()
  async findAll(): Promise<CasosMaltratoDocument[]> {
    return this.casosMaltratoService.findAll();
  }

  @Patch('seguimiento/:numeroDeic')
  @UseInterceptors(FileInterceptor('file')) // Usa FilesInterceptor si quieres permitir varios
  async actualizarSeguimiento(
    @Param('numeroDeic') numeroDeic: string,
    @Body() body: { estadoInvestigacion: string },
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.casosMaltratoService.agregarSeguimiento(numeroDeic, body.estadoInvestigacion, file);
  }

  @Get('buscar/:numeroDeic')
  async buscarPorNumeroDeic(@Param('numeroDeic') numeroDeic: string) {
    return this.casosMaltratoService.buscarPorNumeroDeic(numeroDeic);
  }

  @Get('pendientes-autorizacion')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  async findPendientes() {

    return this.casosMaltratoService.findPendientes();

  }

  @Patch(':id/aprobar-registro')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  async aprobarRegistro(
    @Param('id') id: string,
    @Req() req: any
  ) {

    return this.casosMaltratoService.aprobarRegistro(
      id,
      req.user.userId
    );
  }

  @Patch(':id/rechazar-registro')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ANALISTA)
  async rechazarRegistro(
    @Param('id') id: string,
    @Body() dto: RechazarRegistroDto,
    @Req() req: any
  ) {

    return this.casosMaltratoService.rechazarRegistro(
      id,
      req.user.userId,
      dto.motivo
    );
  }

  //investigador puede ver sus propios registros
  @Get('mis-registros')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVESTIGADOR)
  async findMisRegistros(
    @Req() req: any
  ) {

    return this.casosMaltratoService.findMisRegistros(
      req.user.userId
    );
  }


  @Patch(':id/reenviar-registro')
  @UseGuards(RolesGuard)
  @Roles(UserRole.INVESTIGADOR)
  @UseInterceptors(FileInterceptor('file'))
  async reenviarRegistro(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any
  ) {

    return this.casosMaltratoService.reenviarRegistro(
      id,
      req.user.userId,
      file
    );
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
