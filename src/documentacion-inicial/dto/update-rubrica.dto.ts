import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';


export class RespuestaRubricaDto {

  @IsString()
  codigo: string;


  @IsOptional()
  @IsEnum([
    'SI',
    'NO',
  ])
  respuesta?: 'SI' | 'NO';


  @IsOptional()
  @IsString()
  observaciones?: string;
}


export class UpdateRubricaDto {
  @IsOptional()
  @IsString()
  dependenciaSupervisada?: string;

  @IsOptional()
  @IsString()
  supervisorNombre?: string;

  @IsOptional()
  @IsEnum([
    'SI',
    'NO',
  ])
  conoceProtocolo?: 'SI' | 'NO';


  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespuestaRubricaDto)
  respuestas: RespuestaRubricaDto[];
}
