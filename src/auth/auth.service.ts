import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { contextoAuditoria } from '../auditoria/auditoria-core';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/change-password.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Usuario, UsuarioDocument } from './entities/auth.entity';
import { UserRole } from './enums/user-role.enum';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class AuthService {
  // Consulta los usuarios con rol Investigador y devuelve únicamente sus datos de identificación
  // y estado para los selectores.
  investigadores() {
    return this.usuarioModel.find({ role: UserRole.INVESTIGADOR })
      .select('_id nombre role activo').sort({ nombre: 1 }).lean().exec();
  }

  // Recibe el modelo de usuarios y el servicio JWT necesarios para validar identidades y
  // administrar sesiones.
  constructor(
    @InjectModel(Usuario.name) private usuarioModel: Model<UsuarioDocument>,
    private jwtService: JwtService,
  ) { }

  // Busca el correo, comprueba que la cuenta esté activa y compara la contraseña con su hash.
  // Rechaza credenciales inválidas sin iniciar sesión.
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usuarioModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }
    if (user.activo === false) {
      throw new UnauthorizedException('Usuario inactivo, contacte al administrador');
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    return user;
  }

  // Identifica al usuario en el contexto de auditoría, genera su JWT y lo persiste para mantener
  // una sola sesión válida por cuenta.
  async login(user: any) {
    const auditoria = contextoAuditoria.getStore();
    if (auditoria) auditoria.usuario = { id: String(user._id), nombre: user.nombre, rol: user.role };
    const payload = { sub: user._id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    // Guardar token en el usuario para permitir solo una sesión
    await this.usuarioModel.findByIdAndUpdate(user._id, { token }, { new: true });

    return {
      access_token: token,
    };
  }

  // Borra el token de sesión persistido para invalidar el acceso del usuario.
  async logout(userId: string) {
    await this.usuarioModel.findByIdAndUpdate(userId, { token: null }, { new: true });
    return { message: 'Sesión cerrada' };
  }


  // Valida correo, contraseña y rol, impide correos duplicados y guarda el nuevo usuario con la
  // contraseña protegida mediante hash.
  async register(userData: CreateAuthDto) {
    const { nombre, email, password, role, } = userData ?? {};

    // 1) Validaciones defensivas
    if (!email) throw new BadRequestException('Email requerido');
    if (!password) throw new BadRequestException('Password requerido');
    if (typeof password !== 'string' || password.length < 6) {
      throw new BadRequestException('Password debe tener al menos 6 caracteres');
    }

    // 2) Usuario existente
    const existingUser = await this.usuarioModel.findOne({ email });
    if (existingUser) throw new ConflictException('El usuario ya existe');

    // 3) Salt rounds seguros (usa ENV si lo tienes)
    const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
    if (!Number.isFinite(rounds) || rounds <= 0) {
      throw new Error('BCRYPT_SALT_ROUNDS inválido (debe ser número > 0)');
    }

    // 4) Hash del password
    const hashedPassword = await bcrypt.hash(password, rounds);

    // 5) Crear usuario
    const newUser = await this.usuarioModel.create({
      nombre,
      email,
      password: hashedPassword,
      role,
    });

    // 6) Token inmediato (opcional: también puedes guardar token como en login)
    const payload = { sub: newUser._id, email: newUser.email, role: newUser.role };
    const token = this.jwtService.sign(payload);

    return {
      message: 'Usuario creado e iniciado sesión correctamente',
      access_token: token,
    };
  }


  // Busca al usuario y verifica la contraseña actual antes de guardar el hash de la nueva
  // contraseña y confirmar el cambio.
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usuarioModel.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) throw new BadRequestException('Contraseña actual incorrecta');

    user.password = await bcrypt.hash(dto.newPassword, 10);
    await user.save();

    return { message: 'Contraseña actualizada correctamente' };
  }


  //listar todos los usuarios

  // Consulta los usuarios para administración sin devolver contraseñas ni tokens de sesión.
  async findAllUsers() {
    return await this.usuarioModel
      .find()
      .select('_id nombre email role activo')
      .sort({ email: 1 })
      .lean()

  }

  //actualizar el estado de un usuario

  // Busca la cuenta indicada, actualiza su estado activo y guarda el cambio; informa si el
  // usuario no existe.
  async UpdateUserStatus(userId: string, activo: boolean) {
    const user = await this.usuarioModel.findById(userId);

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    user.activo = activo;

    //desactivar si el usuario esta activo, eliminar token para cerrar sesion
    if (!activo) {
      user.token = null;
    }

    await user.save();

    return {
      message: activo
        ? 'Usuario activado correctamente'
        : 'Usuario desactivado correctamente',
      user: {
        id: user._id,
        nombre: user.nombre,
        email: user.email,
        role: user.role,
        activo: user.activo
      },
    };
  }

  // Busca al usuario y actualiza su nombre o rol cuando fueron proporcionados, devolviendo los
  // datos de identificación de la cuenta.
  async updateUser(userId: string, dto: UpdateUserDto) {

    const user = await this.usuarioModel.findById(userId);

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (dto.nombre !== undefined) {
      user.nombre = dto.nombre.trim();
    }

    if (dto.role !== undefined) {
      user.role = dto.role;
    }

    await user.save();

    return {
      message: 'Usuario actualizado correctamente',
      user: {
        _id: user._id,
        nombre: user.nombre,
        email: user.email,
        role: user.role,
        activo: user.activo,
      },
    };
  }

}
