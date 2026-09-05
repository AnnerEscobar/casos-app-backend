import {
  IsDate,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';

import { Type } from 'class-transformer';

export class DatosLocalizacionDto {

  @IsString()
  direccionLocalizacion: string;

 @IsString()
nombrePersonaConQuienEstaba: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  horaLocalizacion?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fechaLocalizacion?: Date;
}