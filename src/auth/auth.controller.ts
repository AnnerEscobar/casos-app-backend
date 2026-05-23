import { Body, Controller, Get, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './Guards/jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authRateLimitService: AuthRateLimitService,
  ) { }

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rateLimitIdentifier = this.getRateLimitIdentifier(req, body.email);
    this.authRateLimitService.assertAllowed('login', rateLimitIdentifier);
    const user = await this.authService.validateUser(body.email, body.password);
    const { access_token } = await this.authService.login(user);
    this.authRateLimitService.reset('login', rateLimitIdentifier);
    const useSecureCookie = this.useSecureCookie(req);

    res.cookie('access_token', access_token, {
      httpOnly: true,
      sameSite: useSecureCookie ? 'none' : 'lax',
      secure: useSecureCookie,
      maxAge: 60 * 60 * 1000,
    });

    return { message: 'Sesion iniciada correctamente' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('register')
  async register(@Body() body: { email: string; password: string }, @Req() req: Request) {
    this.authRateLimitService.assertAllowed('register', this.getRateLimitIdentifier(req, body.email));
    return this.authService.register(body);
  }

  @Post('recover-password')
  recoverPassword(@Body() body: { email: string }, @Req() req: Request) {
    this.authRateLimitService.assertAllowed('recover-password', this.getRateLimitIdentifier(req, body.email));
    return { message: 'Si la cuenta existe, se iniciara el proceso de recuperacion.' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('session')
  session(@Req() req) {
    return {
      authenticated: true,
      user: req.user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.user.userId);
    const useSecureCookie = this.useSecureCookie(req);
    res.clearCookie('access_token', {
      httpOnly: true,
      sameSite: useSecureCookie ? 'none' : 'lax',
      secure: useSecureCookie,
    });
    return { message: 'Sesion cerrada' };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  changePassword(@Req() req, @Body() dto: ChangePasswordDto) {
    const userId = req.user.userId;
    return this.authService.changePassword(userId, dto);
  }

  private getRateLimitIdentifier(req: Request, email?: string): string {
    const normalizedEmail = email?.trim().toLowerCase() || 'unknown-email';
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    return `${ip}:${normalizedEmail}`;
  }

  private useSecureCookie(req: Request): boolean {
    const requestOrigin = req.headers.origin;
    return (
      process.env.NODE_ENV === 'production' ||
      requestOrigin?.startsWith('https://') === true ||
      process.env.FRONTEND_ORIGIN?.startsWith('https://') === true
    );
  }

}
