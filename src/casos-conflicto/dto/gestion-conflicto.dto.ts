import { Type, Transform } from 'class-transformer';
import { OmitType } from '@nestjs/mapped-types';
import { ArrayMinSize, ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { FichaConflictoDto } from './ficha-conflicto.dto';
import { DireccionInicialAlertaDto } from '../../casos-alerta/dto/gestion-alerta.dto';

export class PersonaGestionConflictoDto {
  @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @IsNotEmpty() @MaxLength(500) nombre: string;
  @IsOptional() @IsString() @MaxLength(30) cui?: string;
  @IsOptional() @IsDateString() fecha_Nac?: string;
  @IsOptional() @IsInt() @Min(0) @Max(130) edadReportada?: number;
  @IsOptional() @IsString() @MaxLength(1000) direccion?: string;
  @IsOptional() @IsIn(['HOMBRE','MUJER','NO INDICA']) sexo?: string;
  @IsOptional() @IsString() @MaxLength(300) alias?: string;
  @IsOptional() @IsString() @MaxLength(300) ocupacion?: string;
  @IsOptional() @IsString() @MaxLength(500) nombrePadre?: string;
  @IsOptional() @IsString() @MaxLength(500) nombreMadre?: string;
  @IsOptional() @IsString() @MaxLength(500) estadoFisico?: string;
  @IsOptional() @IsString() @MaxLength(50) telefono?: string;
  @IsOptional() @IsIn(['VICTIMA','DENUNCIANTE']) tipoPersona?: string;
}
export class CompletarConflictoDto {
  @IsOptional() @Matches(/^(?:M0004|MP001|MPE01)-\d{4}-\d+$/) numeroMp?: string;
  @IsOptional() @IsIn(['Informado','Concluido']) estadoInvestigacion?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>PersonaGestionConflictoDto) infractores?: PersonaGestionConflictoDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>PersonaGestionConflictoDto) victimas?: PersonaGestionConflictoDto[];
  @IsOptional() @ValidateNested() @Type(()=>DireccionInicialAlertaDto) lugarHechos?: DireccionInicialAlertaDto;
  @IsOptional() @ValidateNested() @Type(()=>FichaConflictoDto) fichaConflicto?: FichaConflictoDto;
}
export class RegistroInicialConflictoDto extends OmitType(CompletarConflictoDto,['infractores'] as const) {
  @IsString() @IsNotEmpty() @Matches(/^DEIC53-\d{4}-\d{2}-\d{2}-\d+$/) numeroDeic: string;
  @IsDateString() fechaIngreso: string;
  @IsMongoId() investigadorAsignado: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>PersonaGestionConflictoDto) infractores: PersonaGestionConflictoDto[];
}
