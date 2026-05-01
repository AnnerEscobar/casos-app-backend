import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray } from 'class-validator';

export class CreateInformeDto {
  @IsString()
  @IsNotEmpty()
  numeroDeic: string;

  @IsString()
  @IsNotEmpty()
  numeroMp: string;

  @IsEnum(['alerta', 'maltrato', 'conflicto'])
  tipoInforme: string;

  @IsOptional()
  datosGenerales?: any;

  @IsOptional()
  perfilVictima?: any;

  @IsOptional()
  perfilSecundario?: any;

  @IsOptional()
  entrevistas?: any;

  @IsOptional()
  perfilacionLugar?: any;

  @IsOptional()
  diligencias?: any;

  @IsOptional()
  conclusiones?: any;
}