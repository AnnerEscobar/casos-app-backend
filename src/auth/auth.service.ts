import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Usuario } from './entities/auth.entity';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectModel(Usuario.name) private userModel: Model<Usuario>,
  ) { }

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
  const { email, password } = userData ?? {};

  // 1) Validaciones defensivas
  if (!email) throw new BadRequestException('Email requerido');
  if (!password) throw new BadRequestException('Password requerido');
  if (typeof password !== 'string' || password.length < 6) {
    throw new BadRequestException('Password debe tener al menos 6 caracteres');
  }

  // 2) Usuario existente
  const existingUser = await this.usersService.findByEmail(email);
  if (existingUser) throw new ConflictException('El usuario ya existe');

  // 3) Salt rounds seguros (usa ENV si lo tienes)
  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
  if (!Number.isFinite(rounds) || rounds <= 0) {
    throw new Error('BCRYPT_SALT_ROUNDS inválido (debe ser número > 0)');
  }

  // 4) Hash del password
  const hashedPassword = await bcrypt.hash(password, rounds);

  // 5) Crear usuario
  const newUser = await this.usersService.create({
    email,
    password: hashedPassword,
  });

  // 6) Token inmediato (opcional: también puedes guardar token como en login)
  const payload = { sub: newUser._id, email: newUser.email };
  const token = this.jwtService.sign(payload);

  return {
    message: 'Usuario creado e iniciado sesión correctamente',
    access_token: token,
  };
}


  async changePassword(userId: string, dto: ChangePasswordDto) {
    console.log('Cambiar contraseña de usuario:', userId);
    const user = await this.userModel.findById(userId);
    console.log('Cambiar contraseña de usuario despues de la llamada:', userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) throw new BadRequestException('Contraseña actual incorrecta');

    user.password = await bcrypt.hash(dto.newPassword, 10);
    await user.save();

    return { message: 'Contraseña actualizada correctamente' };
  }

  async findById(id: string): Promise<Usuario | null> {
    return this.userModel.findById(id);
  }

}
