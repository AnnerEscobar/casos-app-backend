import { IsOptional, IsString } from 'class-validator';

export class DenuncianteDto {

  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  cui?: string;

  @IsOptional()
  @IsString()
  telefono?: string;
}