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


  @IsEnum([
    'SI',
    'NO',
  ])
  respuesta: 'SI' | 'NO';


  @IsOptional()
  @IsString()
  observaciones?: string;
}


export class UpdateRubricaDto {

  @IsEnum([
    'SI',
    'NO',
  ])
  conoceProtocolo: 'SI' | 'NO';


  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespuestaRubricaDto)
  respuestas: RespuestaRubricaDto[];
}