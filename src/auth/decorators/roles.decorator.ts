import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_KEY = 'roles';

// Asocia los roles permitidos a la ruta o controlador para que RolesGuard pueda comprobar el
// acceso.
export const Roles = (...roles: UserRole[]) =>
  SetMetadata(ROLES_KEY, roles); 