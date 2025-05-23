import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './entities/user.schema';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) { }

  // Crear nuevo usuario
  async create(data: { email: string; password: string }) {
    const createdUser = new this.userModel(data);
    return createdUser.save();
  }

  // Buscar por email
  async findByEmail(email: string) {
    return this.userModel.findOne({ email });
  }

  // Buscar por ID para validación de sesión
  async findByToken(userId: string) {
    return this.userModel.findById(userId);
  }

  // Guardar o borrar token
  async updateToken(userId: string, token: string | null) {
    return this.userModel.findByIdAndUpdate(userId, { token }, { new: true });
  }

  // Validar usuario (para login)
  async validateUser(email: string, password: string) {
    const user = await this.findByEmail(email);
    if (!user) return null;

    const isMatch = await bcrypt.compare(password, user.password);
    return isMatch ? user : null;
  }

  /** Devuelve { email, role } del usuario con este ID */
  async getUserData(_id: string): Promise<{ email: string; role: string }> {
    const user = await this.userModel
      .findById(_id)
      .select('email role')
      .lean()
      .exec();
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return { email: user.email, role: user.role };
  }

}
