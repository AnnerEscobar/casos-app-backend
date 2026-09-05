import {
  IsNotEmpty,
  IsString
} from 'class-validator';

export class LugarHechosDto {

  @IsString()
  @IsNotEmpty()
  departamento: string;

  @IsString()
  @IsNotEmpty()
  municipio: string;

  @IsString()
  @IsNotEmpty()
  direccionDetallada: string;
}