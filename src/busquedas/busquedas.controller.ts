import { BusquedaAccesoService } from './busqueda-acceso.service';
import { CrearSolicitudAccesoDto, ResolverSolicitudAccesoDto } from './solicitud-acceso.dto';
import { Controller, Req, Patch, Get, Post, Body, Param, Delete, Query, NotFoundException, Res, UseGuards } from '@nestjs/common';
import { BusquedasService } from './busquedas.service';
import { CreateBusquedaDto } from './dto/create-busqueda.dto';
import { Response } from 'express'; // Importar Response desde express
import { JwtAuthGuard } from 'src/auth/Guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('busquedas')
export class BusquedasController {
  constructor(private readonly busquedasService: BusquedasService, private readonly acceso: BusquedaAccesoService) { }

  @Get('por-expedienteMp')
  async buscarPorExpedienteMP(@Query('numeroMp') numeroMp: string, @Req() req: any) {
    if (!numeroMp) {
      throw new NotFoundException('El número de expediente MP es requerido.');
    }
    return this.acceso.presentar(await this.busquedasService.buscarPorExpedienteMP(numeroMp.trim().toUpperCase()), req.user, true);
  }

  @Get('por-numero-deic')
  async buscarPorNumeroDeic(@Query('numeroDeic') numeroDeic: string, @Req() req: any) {
    if (!numeroDeic) {
      throw new NotFoundException('El número DEIC es requerido.');
    }
    return this.acceso.presentar(await this.busquedasService.buscarPorNumeroDeic(numeroDeic.trim().toUpperCase()), req.user, true);
  }

  @Get('por-numero-alerta')
  async buscarPorNumeroAlerta(@Query('numeroAlerta') numeroAlerta: string, @Req() req: any) {
    if (!numeroAlerta) {
      throw new NotFoundException('El número de alerta es requerido.');
    }
    return this.acceso.presentar(await this.busquedasService.buscarPorAlertaAlbaKeneth(numeroAlerta.trim().toUpperCase()), req.user, true);
  }

  @Get('por-nombre') // Ruta relativa: /busquedas/por-nombre
  async buscarPorNombre(@Query('nombre') nombre: string, @Req() req: any) {
    if (!nombre) {
      throw new NotFoundException('El nombre es requerido.');
    }
    return this.acceso.presentar(await this.busquedasService.buscarPorNombre(nombre.trim()), req.user, false);
  }

  @Get('por-cui')
  async buscarPorCUI(@Query('cui') cui: string, @Req() req: any) {
    if (!cui) {
      throw new NotFoundException('El CUI/DPI es requerido.');
    }
    return this.acceso.presentar(await this.busquedasService.buscarPorCUI(cui.trim()), req.user, false);
  }

  @Get('buscar')
  async buscar(@Query() filtros: any, @Req() req: any) {
    const casos = await this.acceso.presentar(await this.busquedasService.buscarCasosFiltrados(filtros), req.user);
    return casos.filter(c => (!filtros.origenCaso || (c.origenCaso || 'SISTEMA') === filtros.origenCaso)
      && (!filtros.investigador || c.investigador?._id === filtros.investigador));
  }

  @Get('expediente/:tipo/:id')
  detalle(@Param('tipo') tipo: string, @Param('id') id: string, @Req() req: any) { return this.acceso.detalle(tipo, id, req.user); }
  @Post('solicitudes')
  solicitar(@Body() dto: CrearSolicitudAccesoDto, @Req() req: any) { return this.acceso.solicitar(dto, req.user); }
  @Get('investigadores')
  investigadores(@Req() req: any) { return this.acceso.investigadores(req.user); }
  @Get('compartidos')
  compartidos(@Req() req: any) { return this.acceso.compartidos(req.user); }
  @Patch('solicitudes/:id/revocar')
  revocar(@Param('id') id: string, @Req() req: any) { return this.acceso.revocar(id, req.user); }
  @Get('solicitudes')
  solicitudes(@Req() req: any) { return this.acceso.listar(req.user); }
  @Get('bandeja-accesos')
  bandejaAccesos(@Req() req: any) { return this.acceso.bandeja(req.user); }
  @Patch('solicitudes/:id')
  resolver(@Param('id') id: string, @Body() dto: ResolverSolicitudAccesoDto, @Req() req: any) { return this.acceso.resolver(id, dto.estado, req.user); }

  @Get('estadisticas-mensuales')
  obtenerEstadisticasMensuales() {
    return this.busquedasService.obtenerEstadisticasMensuales();
  }













  @Post()
  create(@Body() createBusquedaDto: CreateBusquedaDto) {
    return this.busquedasService.create(createBusquedaDto);
  }

  @Get()
  findAll() {
    return this.busquedasService.findAll();
  }


  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.busquedasService.remove(+id);
  }
}
