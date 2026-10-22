import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/Guards/jwt-auth.guard';
import { RolesGuard } from '../auth/Guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuditoriaService } from './auditoria.service';

@Controller('auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.JEFE)
export class AuditoriaController {
  // Recibe el servicio que consulta y verifica los registros de auditoría.
  constructor(private readonly auditoria: AuditoriaService) {}
  // Expone la búsqueda paginada de eventos para los roles autorizados y evita almacenar la
  // respuesta en caché.
  @Get()
  buscar(@Query() query: Record<string, string>, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.auditoria.buscar(query);
  }
  // Devuelve un evento por su identificador único, con su verificación de integridad y sin
  // permitir caché de la respuesta.
  @Get(':eventoId')
  detalle(@Param('eventoId') eventoId: string, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.auditoria.detalle(eventoId);
  }
}
