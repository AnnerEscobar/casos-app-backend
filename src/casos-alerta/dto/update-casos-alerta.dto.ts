import { PartialType } from '@nestjs/mapped-types';
import { CreateCasosAlertaDto } from './create-casos-alerta.dto';
import { IsDate, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCasosAlertaDto {

@IsOptional()
  @IsString()
  nuevoEstado?: string;

  @IsOptional()
  @IsString()
  nombreAcompanante?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  direccionLocalizacion?: string;

  @IsOptional()
  @IsString()
  horaLocalizacion?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fechaLocalizacion?: Date;

}
