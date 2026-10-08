import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';


export class UpdateDatosCaratulaDto {

  @IsOptional()
  @IsString()
  numeroMp?: string;


  @IsOptional()
  @IsString()
  numeroAlerta?: string;


  @IsOptional()
  @IsString()
  nombre?: string;


  @IsOptional()
  @IsString()
  edad?: string;


  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaNac?: Date;


  @IsOptional()
  @IsString()
  lugar?: string;


  @IsOptional()
  @IsString()
  departamento?: string;


  @IsOptional()
  @IsString()
  municipio?: string;


  @IsOptional()
  @IsString()
  observaciones?: string;
}


export class UpdateCaratulaDocumentacionDto {

  @IsOptional()
  @IsString()
  numeroDeic?: string;


  @IsOptional()
  @IsEnum(['OFICIO', 'REQUERIMIENTO'])
  modalidadMaltrato?: 'OFICIO' | 'REQUERIMIENTO';


  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateDatosCaratulaDto)
  caratula?: UpdateDatosCaratulaDto;
}