
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { MongooseModule } from '@nestjs/mongoose';
import { Usuario, UsuarioSchema } from './entities/auth.entity';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { RolesGuard } from './Guards/roles.guard';
import { SesionesService } from './sesiones.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'local_jwt_secret',
    }),
     MongooseModule.forFeature([{ name: Usuario.name, schema: UsuarioSchema }])
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AuthRateLimitService, RolesGuard, SesionesService],
  exports: [AuthService, RolesGuard],
  

})
export class AuthModule { }
