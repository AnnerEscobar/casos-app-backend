import { Type } from 'class-transformer';
import { OmitType } from '@nestjs/mapped-types';
import { ArrayMinSize, ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { FichaMaltratoDto } from './ficha-maltrato.dto';
import { DireccionInicialAlertaDto } from '../../casos-alerta/dto/gestion-alerta.dto';

export class PersonaGestionMaltratoDto {
  @IsString() @IsNotEmpty() @MaxLength(500) nombre: string;
  @IsOptional() @IsString() @MaxLength(30) cui?: string;
  @IsOptional() @IsDateString() fecha_Nac?: string;
  @IsOptional() @IsInt() @Min(0) @Max(130) edadReportada?: number;
  @IsOptional() @IsString() @MaxLength(1000) direccion?: string;
  @IsOptional() @IsString() @MaxLength(200) departamento?: string;
  @IsOptional() @IsString() @MaxLength(200) municipio?: string;
  @IsOptional() @IsString() @MaxLength(50) zona?: string;
  @IsOptional() @IsString() @MaxLength(200) etnia?: string;
  @IsOptional() @IsIn(['HOMBRE','MUJER','NO INDICA']) sexo?: string;
  @IsOptional() @IsString() @MaxLength(200) nacionalidad?: string;
  @IsOptional() @IsString() @MaxLength(300) ocupacion?: string;
  @IsOptional() @IsString() @MaxLength(300) parentesco?: string;
  @IsOptional() @IsString() @MaxLength(500) denuncianteNombre?: string;
  @IsOptional() @IsString() @MaxLength(50) denuncianteTelefono?: string;
  @IsOptional() @IsString() @MaxLength(300) denuncianteParentesco?: string;
}
export class CompletarMaltratoDto {
  @IsOptional() @Matches(/^(?:(?:MPE01|M0008|MP004|M0030|MP001)-\d{4}-\d+|IC\/PNCORLLAT\d+-\d{4}-\d+)$/) numeroMp?: string;
  @IsOptional() @IsIn(['Informado','Desestimado']) estadoInvestigacion?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>PersonaGestionMaltratoDto) victimas?: PersonaGestionMaltratoDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>PersonaGestionMaltratoDto) sindicados?: PersonaGestionMaltratoDto[];
  @IsOptional() @ValidateNested() @Type(()=>DireccionInicialAlertaDto) lugarHechos?: DireccionInicialAlertaDto;
  @IsOptional() @ValidateNested() @Type(()=>FichaMaltratoDto) fichaMaltrato?: FichaMaltratoDto;
}
export class RegistroInicialMaltratoDto extends OmitType(CompletarMaltratoDto,['victimas'] as const) {
  @IsString() @IsNotEmpty() @Matches(/^DEIC51-\d{4}-\d{2}-\d{2}-\d+$/) numeroDeic: string;
  @IsDateString() fechaIngreso: string;
  @IsMongoId() investigadorAsignado: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>PersonaGestionMaltratoDto) victimas: PersonaGestionMaltratoDto[];
}
