import { IsNotEmpty, IsString } from 'class-validator';

export class LugarDesaparicionDto {

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