import { IsOptional, IsString, IsEnum, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCaratulaDto {
  @IsEnum(['Alerta', 'Maltrato', 'Conflicto'])
  tipoCaso: 'Alerta' | 'Maltrato' | 'Conflicto';

  @IsString()
  numeroDeic: string;

  @IsString()
  @IsOptional()
  numeroMp?: string;

  @IsString()
  @IsOptional()
  numeroAlerta?: string;

  @IsString()
  nombre: string;

  @IsOptional()
  @Type(() => Date)
  fecha_Nac?: Date;

  @IsString()
  lugar: string;

  @IsOptional()
  @IsString()
  departamento?: string;

  @IsOptional()
  @IsString()
  municipio?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsString()
  investigador: string;
}
