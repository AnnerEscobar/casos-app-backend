import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Usuario, UsuarioDocument } from './entities/auth.entity';
import { SesionesService } from './sesiones.service';

// Busca una cookie por su nombre y decodifica su valor; devuelve null si la cabecera no la
// contiene.
const getCookieValue = (cookieHeader: string | undefined, name: string): string | null => {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) return null;

  return decodeURIComponent(match.slice(name.length + 1));
};

// Obtiene el JWT de la cookie de acceso o, como alternativa, de la cabecera Authorization con
// esquema Bearer.
const extractJwtFromRequest = (req: Request): string | null => {
  return (
    getCookieValue(req.headers.cookie, 'access_token') ??
    ExtractJwt.fromAuthHeaderAsBearerToken()(req)
  );
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  // Configura la extracción y validación del JWT con Passport y recibe el modelo de usuarios
  // para comprobar la sesión persistida.
  constructor(@InjectModel(Usuario.name) private usuarioModel: Model<UsuarioDocument>, private sesiones: SesionesService) {
    super({
      jwtFromRequest: extractJwtFromRequest,
      ignoreExpiration: false,
      passReqToCallback: true,
      secretOrKey: process.env.JWT_SECRET ?? 'local_jwt_secret',
    });
  }

 // Verifica que el usuario exista, esté activo y conserve el mismo token de sesión. Devuelve
 // solo su identidad y expiración para los controladores.
 async validate(req: Request, payload: any) {
  const user = await this.usuarioModel.findById(payload.sub);
  const token = extractJwtFromRequest(req);

  if (!user ||user.activo === false ||!token || user.token !== token) {
    throw new UnauthorizedException();
  }
  await this.sesiones.validar(user);

  // Retornar solo los datos que necesitas
  return {
    userId: user._id,
    nombre: user.nombre,
    email: user.email,
    role: user.role,
    exp: payload.exp,
    sesionId: user.sesionId,
    expiresAt: new Date(user.sesionExpira).getTime(),
  };
}

}
