import { IsString, IsOptional, IsArray } from 'class-validator';

export class UpdateInformeDto {
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

  @IsOptional()
  @IsArray()
  seccionesCompletadas?: string[];

  @IsOptional()
  estado?: string;

  @IsOptional()
  wordUrl?: string;

  @IsOptional()
  pdfFinalUrl?: string;
}