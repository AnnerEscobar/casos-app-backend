import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';


export class ElementoPlanDto {

  @IsString()
  codigo: string;


  @IsOptional()
  @IsString()
  informacionObtenida?: string;


  @IsOptional()
  @IsString()
  informacionNecesitaObtener?: string;


  @IsOptional()
  @IsString()
  diligenciasRealizar?: string;
}


export class UpdatePlanInvestigacionDto {

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ElementoPlanDto)
  elementos: ElementoPlanDto[];


  @IsOptional()
  @IsString()
  observaciones?: string;
}