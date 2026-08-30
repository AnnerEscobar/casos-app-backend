import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

export class UpdateUserDto {

  @IsOptional()
  @IsString()
  @MinLength(3)
  nombre?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}