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
  // Recibe los servicios de búsqueda y acceso que consultan los casos y filtran la información
  // según la sesión.
  constructor(private readonly busquedasService: BusquedasService, private readonly acceso: BusquedaAccesoService) { }

  // Valida y normaliza el número MP, busca en los tres tipos de caso y presenta únicamente la
  // información permitida para el usuario.
  @Get('por-expedienteMp')
  async buscarPorExpedienteMP(@Query('numeroMp') numeroMp: string, @Req() req: any) {
    if (!numeroMp) {
      throw new NotFoundException('El número de expediente MP es requerido.');
    }
    return this.acceso.presentar(await this.busquedasService.buscarPorExpedienteMP(numeroMp.trim().toUpperCase()), req.user, true);
  }

  // Valida y normaliza el DEIC, busca el expediente y aplica las restricciones de acceso antes
  // de responder.
  @Get('por-numero-deic')
  async buscarPorNumeroDeic(@Query('numeroDeic') numeroDeic: string, @Req() req: any) {
    if (!numeroDeic) {
      throw new NotFoundException('El número DEIC es requerido.');
    }
    return this.acceso.presentar(await this.busquedasService.buscarPorNumeroDeic(numeroDeic.trim().toUpperCase()), req.user, true);
  }

  // Valida el número de alerta y devuelve las coincidencias con la visibilidad que corresponde
  // al usuario.
  @Get('por-numero-alerta')
  async buscarPorNumeroAlerta(@Query('numeroAlerta') numeroAlerta: string, @Req() req: any) {
    if (!numeroAlerta) {
      throw new NotFoundException('El número de alerta es requerido.');
    }
    return this.acceso.presentar(await this.busquedasService.buscarPorAlertaAlbaKeneth(numeroAlerta.trim().toUpperCase()), req.user, true);
  }

  // Exige un nombre de búsqueda y presenta las coincidencias sin revelar expedientes
  // restringidos.
  @Get('por-nombre') // Ruta relativa: /busquedas/por-nombre
  async buscarPorNombre(@Query('nombre') nombre: string, @Req() req: any) {
    if (!nombre) {
      throw new NotFoundException('El nombre es requerido.');
    }
    return this.acceso.presentar(await this.busquedasService.buscarPorNombre(nombre.trim()), req.user, false);
  }

  // Exige el CUI o DPI de consulta y filtra las coincidencias según los permisos de la sesión.
  @Get('por-cui')
  async buscarPorCUI(@Query('cui') cui: string, @Req() req: any) {
    if (!cui) {
      throw new NotFoundException('El CUI/DPI es requerido.');
    }
    return this.acceso.presentar(await this.busquedasService.buscarPorCUI(cui.trim()), req.user, false);
  }

  // Aplica los filtros de búsqueda y de acceso, incluido origen del expediente e investigador
  // cuando se especifican.
  @Get('buscar')
  async buscar(@Query() filtros: any, @Req() req: any) {
    const casos = await this.acceso.presentar(await this.busquedasService.buscarCasosFiltrados(filtros), req.user);
    return casos.filter(c => (!filtros.origenCaso || (c.origenCaso || 'SISTEMA') === filtros.origenCaso)
      && (!filtros.investigador || c.investigador?._id === filtros.investigador));
  }

  // Solicita el detalle autorizado del expediente identificado por tipo e ID.
  @Get('expediente/:tipo/:id')
  detalle(@Param('tipo') tipo: string, @Param('id') id: string, @Req() req: any) { return this.acceso.detalle(tipo, id, req.user); }
  // Crea una solicitud de acceso usando la identidad de la sesión y los datos validados del
  // formulario.
  @Post('solicitudes')
  solicitar(@Body() dto: CrearSolicitudAccesoDto, @Req() req: any) { return this.acceso.solicitar(dto, req.user); }
  // Expone el directorio de investigadores que el servicio permite consultar al usuario.
  @Get('investigadores')
  investigadores(@Req() req: any) { return this.acceso.investigadores(req.user); }
  // Entrega los expedientes compartidos accesibles para el investigador autenticado.
  @Get('compartidos')
  compartidos(@Req() req: any) { return this.acceso.compartidos(req.user); }
  // Solicita la revocación del permiso indicado usando la identidad autenticada como responsable
  // de la operación.
  @Patch('solicitudes/:id/revocar')
  revocar(@Param('id') id: string, @Req() req: any) { return this.acceso.revocar(id, req.user); }
  // Devuelve las solicitudes de acceso que puede consultar el usuario conectado.
  @Get('solicitudes')
  solicitudes(@Req() req: any) { return this.acceso.listar(req.user); }
  // Entrega la bandeja de solicitudes con las acciones que la sesión puede resolver o revocar.
  @Get('bandeja-accesos')
  bandejaAccesos(@Req() req: any) { return this.acceso.bandeja(req.user); }
  // Envía al servicio la decisión de autorizar o rechazar una solicitud, junto con la identidad
  // de quien decide.
  @Patch('solicitudes/:id')
  resolver(@Param('id') id: string, @Body() dto: ResolverSolicitudAccesoDto, @Req() req: any) { return this.acceso.resolver(id, dto.estado, req.user); }

  // Devuelve el consolidado mensual de registros obtenido por el servicio de búsquedas.
  @Get('estadisticas-mensuales')
  obtenerEstadisticasMensuales() {
    return this.busquedasService.obtenerEstadisticasMensuales();
  }













  // Delega en el método provisional de creación de búsquedas; esta ruta todavía no incorpora
  // persistencia.
  @Post()
  create(@Body() createBusquedaDto: CreateBusquedaDto) {
    return this.busquedasService.create(createBusquedaDto);
  }

  // Delega en el listado provisional de búsquedas; actualmente devuelve una respuesta de
  // ejemplo.
  @Get()
  findAll() {
    return this.busquedasService.findAll();
  }


  // Delega en la operación provisional de eliminación; no borra registros de búsqueda en la
  // base.
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.busquedasService.remove(+id);
  }
}
