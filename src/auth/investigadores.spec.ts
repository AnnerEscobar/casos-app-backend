import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsuarioDocument } from './entities/auth.entity';
import { UserRole } from './enums/user-role.enum';
import { ROLES_KEY } from './decorators/roles.decorator';
import { JwtAuthGuard } from './Guards/jwt-auth.guard';
import { RolesGuard } from './Guards/roles.guard';

describe('Directorio de investigadores para históricos', () => {
  it('requiere sesión y roles de incorporación, conservando users exclusivo de Admin', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype.investigadores)).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, AuthController.prototype.investigadores)).toEqual([UserRole.ANALISTA, UserRole.INVESTIGADOR]);
    expect(Reflect.getMetadata(ROLES_KEY, AuthController.prototype.findAllUsers)).toEqual([UserRole.ADMIN]);
  });

  it('limita la consulta a investigadores sin exponer correo, contraseña o token', async () => {
    const usuarios = [{ _id: 'original', nombre: 'Juan', role: UserRole.INVESTIGADOR, activo: false }];
    const query = { select: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(usuarios) };
    const model = { find: jest.fn().mockReturnValue(query) };
    const service = new AuthService(model as unknown as Model<UsuarioDocument>, {} as JwtService, {} as any);
    expect(await service.investigadores()).toEqual(usuarios);
    expect(model.find).toHaveBeenCalledWith({ role: UserRole.INVESTIGADOR });
    expect(query.select).toHaveBeenCalledWith('_id nombre role activo');
  });
});
