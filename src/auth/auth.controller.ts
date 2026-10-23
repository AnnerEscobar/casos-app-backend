import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './Guards/jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { Request, Response } from 'express';
import { RolesGuard } from './Guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from './enums/user-role.enum';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { INACTIVIDAD_MS, SesionesService } from './sesiones.service';

@Controller('auth')
export class AuthController {
  // Devuelve el directorio de investigadores permitido para los roles que incorporan o asignan
  // expedientes.
  @Get('investigadores')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ANALISTA, UserRole.INVESTIGADOR)
  async investigadores() {
    return this.authService.investigadores();
  }

  // Recibe los servicios de autenticación y control de intentos utilizados por las rutas de
  // usuarios y sesiones.
  constructor(
    private readonly authService: AuthService,
    private readonly authRateLimitService: AuthRateLimitService,
    private readonly sesiones: SesionesService,
  ) { }

  // Controla los intentos, valida las credenciales y establece la cookie de sesión. Devuelve la
  // fecha de expiración sin exponer el token al cliente.
  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rateLimitIdentifier = this.getRateLimitIdentifier(req, body.email);
    this.authRateLimitService.assertAllowed('login', rateLimitIdentifier);
    const user = await this.authService.validateUser(body.email, body.password);
    const { access_token, expiresAt, idleTimeoutMs } = await this.authService.login(user);
    this.authRateLimitService.reset('login', rateLimitIdentifier);
    const useSecureCookie = this.useSecureCookie(req);

    res.cookie('access_token', access_token, {
      httpOnly: true,
      sameSite: useSecureCookie ? 'none' : 'lax',
      secure: useSecureCookie,
      maxAge: INACTIVIDAD_MS + 60000,
    });

    return {
      message: 'Sesion iniciada correctamente',
      expiresAt, idleTimeoutMs,
    };
  }


  // Recibe el alta de un usuario desde una sesión administradora, comprueba su límite de
  // intentos y delega la creación al servicio.
  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async register(
    @Body() body: CreateAuthDto,
    @Req() req: Request) {
    this.authRateLimitService.assertAllowed('register', this.getRateLimitIdentifier(req, body.email));
    return this.authService.register(body);
  }



  // Devuelve la identidad que ya fue validada por el guard para confirmar que la sesión continúa
  // activa.
  @UseGuards(JwtAuthGuard)
  @Get('session')
  session(@Req() req) {
    return {
      authenticated: true,
      user: req.user,
      expiresAt: req.user.expiresAt, idleTimeoutMs: INACTIVIDAD_MS,
    };
  }

  // Renueva el vencimiento solo ante interacción del usuario. El guard comprueba
  // primero la sesión y el servicio actualiza su plazo dentro de la transacción.
  @UseGuards(JwtAuthGuard)
  @Post('actividad')
  async actividad(@Req() req, @Res({ passthrough: true }) res: Response) {
    const datos = await this.sesiones.actividad(req.user.userId, req.user.sesionId);
    const token = req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('access_token='))?.slice('access_token='.length);
    if (token) {
      const secure = this.useSecureCookie(req);
      res.cookie('access_token', decodeURIComponent(token), { httpOnly: true, sameSite: secure ? 'none' : 'lax', secure, maxAge: INACTIVIDAD_MS + 60000 });
    }
    return datos;
  }

  // Invalida el token persistido del usuario y elimina la cookie de autenticación de la
  // respuesta.
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.user.userId, req.user.sesionId);
    const useSecureCookie = this.useSecureCookie(req);
    res.clearCookie('access_token', {
      httpOnly: true,
      sameSite: useSecureCookie ? 'none' : 'lax',
      secure: useSecureCookie,
    });
    return { message: 'Sesion cerrada' };
  }

  // Solicita el cambio de contraseña para el usuario autenticado usando los datos validados del
  // formulario.
  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  changePassword(@Req() req, @Body() dto: ChangePasswordDto) {
    const userId = req.user.userId;
    return this.authService.changePassword(userId, dto);
  }

  // Combina la dirección de conexión y el correo normalizado para identificar los intentos de
  // autenticación o registro.
  private getRateLimitIdentifier(req: Request, email?: string): string {
    const normalizedEmail = email?.trim().toLowerCase() || 'unknown-email';
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    return `${ip}:${normalizedEmail}`;
  }

  // Determina si la cookie debe enviarse como segura según el entorno y el uso de HTTPS en el
  // origen del frontend.
  private useSecureCookie(req: Request): boolean {
    const requestOrigin = req.headers.origin;
    return (
      process.env.NODE_ENV === 'production' ||
      requestOrigin?.startsWith('https://') === true ||
      process.env.FRONTEND_ORIGIN?.startsWith('https://') === true
    );
  }

  //metodo para servir lista de usuarios, solo accesible para administradores

  // Entrega el listado de usuarios mediante la ruta restringida a administradores.
  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAllUsers() {
    return this.authService.findAllUsers();
  }

  //metodo para actualizar el estado de un usuario, solo accesible para administradores

  // Permite al administrador activar o desactivar un usuario y evita que desactive su propia
  // cuenta.
  @Patch('users/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async UpdateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: any) {
    if (
      req.user.userId.toString() === id &&
      dto.activo === false
    ) {
      throw new BadRequestException(
        'No puedes desactivar tu propio usuario',
      );
    }
    return this.authService.UpdateUserStatus(id, dto.activo);
  }


  //acutalizar nombre y rol del usuario, solo accesible para administradores

  // Actualiza los datos permitidos de un usuario e impide que el administrador conectado se
  // quite su propio rol.
  @Patch('users/:id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
async updateUser(
  @Param('id') id: string,
  @Body() dto: UpdateUserDto,
  @Req() req: any,
) {

  if (
    req.user.userId.toString() === id &&
    dto.role !== undefined &&
    dto.role !== UserRole.ADMIN
  ) {
    throw new BadRequestException(
      'No puedes modificar tu propio rol de administrador',
    );
  }

  return this.authService.updateUser(id, dto);
}

}
