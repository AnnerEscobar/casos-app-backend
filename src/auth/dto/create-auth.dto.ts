import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

export class CreateAuthDto {

    @IsString()
    @MinLength(3)
    nombre: string;

    @IsEmail()
    email: string;

    @IsString()
    @MinLength(6)
    password: string;

    @IsEnum(UserRole)
    role: UserRole;
}