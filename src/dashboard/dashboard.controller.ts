import {
  Controller,
  Get,
  Req,
  UseGuards
} from '@nestjs/common';

import {
  DashboardService
} from './dashboard.service';

import {
  JwtAuthGuard
} from '../auth/Guards/jwt-auth.guard';


@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {

  // Recibe el servicio que construye las estadísticas del panel según el usuario autenticado.
  constructor(
    private readonly dashboardService:
      DashboardService
  ) {}


  // Solicita los indicadores y gráficos del panel usando el período de consulta y la identidad
  // de la sesión.
  @Get()
  obtenerDashboard(
    @Req() req: any
  ) {

    return this.dashboardService
      .obtenerDashboard(
        req.user
      );

  }

}