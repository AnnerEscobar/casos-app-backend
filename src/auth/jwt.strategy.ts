import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Usuario, UsuarioDocument } from './entities/auth.entity';

const getCookieValue = (cookieHeader: string | undefined, name: string): string | null => {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) return null;

  return decodeURIComponent(match.slice(name.length + 1));
};

const extractJwtFromRequest = (req: Request): string | null => {
  return (
    getCookieValue(req.headers.cookie, 'access_token') ??
    ExtractJwt.fromAuthHeaderAsBearerToken()(req)
  );
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@InjectModel(Usuario.name) private usuarioModel: Model<UsuarioDocument>) {
    super({
      jwtFromRequest: extractJwtFromRequest,
      ignoreExpiration: false,
      passReqToCallback: true,
      secretOrKey: process.env.JWT_SECRET ?? 'local_jwt_secret',
    });
  }

 async validate(req: Request, payload: any) {
  const user = await this.usuarioModel.findById(payload.sub);
  const token = extractJwtFromRequest(req);

  if (!user || !token || user.token !== token) {
    throw new UnauthorizedException();
  }

  // Retornar solo los datos que necesitas
  return {
    userId: user._id,
    email: user.email,
    role: user.role,
    exp: payload.exp,
  };
}

}
