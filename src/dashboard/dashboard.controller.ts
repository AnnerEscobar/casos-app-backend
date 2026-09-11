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

  constructor(
    private readonly dashboardService:
      DashboardService
  ) {}


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