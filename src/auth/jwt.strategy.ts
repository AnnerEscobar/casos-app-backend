import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'jwt_secret_key', // Reemplaza por variable de entorno
    });
  }

 async validate(payload: any) {
  const user = await this.usersService.findById(payload.sub);
  if (!user) {
    throw new UnauthorizedException();
  }

  // Retornar solo los datos que necesitas
  return {
    userId: user._id,
    email: user.email,
    nombre: user.role
  };
}

}
