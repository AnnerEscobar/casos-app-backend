import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import {
  ROLES_KEY,
} from '../decorators/roles.decorator';

import {
  UserRole,
} from '../enums/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {

  // Recibe el lector de metadatos usado para consultar los roles definidos en rutas y
  // controladores.
  constructor(private reflector: Reflector) {}

  // Comprueba los roles exigidos por la ruta frente al usuario autenticado. Permite rutas sin
  // restricción de rol y rechaza identidades o roles no autorizados.
  canActivate(context: ExecutionContext): boolean {

    const requiredRoles =
      this.reflector.getAllAndOverride<UserRole[]>(
        ROLES_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    // Si el endpoint no tiene @Roles(),
    // no aplicamos restricción por rol.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        'No se pudo identificar el usuario',
      );
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        'No tienes permisos para realizar esta acción',
      );
    }

    return true;
  }
}