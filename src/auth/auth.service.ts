import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    return user;
  }

  async login(user: any) {
    const payload = { sub: user._id, email: user.email };
    const token = this.jwtService.sign(payload);

    // Guardar token en el usuario para permitir solo una sesión
    await this.usersService.updateToken(user._id, token);

    return {
      access_token: token,
    };
  }

  async logout(userId: string) {
    await this.usersService.updateToken(userId, null);
    return { message: 'Sesión cerrada' };
  }


  async register(userData: { email: string; password: string }) {
    const { email, password } = userData;
  
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) throw new Error('El usuario ya existe');
  
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await this.usersService.create({
      email,
      password: hashedPassword,
    });
  
    // Generar token inmediatamente
    const payload = { sub: newUser._id, email: newUser.email };
    const token = this.jwtService.sign(payload);
  
    return {
      message: 'Usuario creado e iniciado sesión correctamente',
      access_token: token,
    };
  }
}
