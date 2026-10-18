import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsMongoId, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { FichaAlertaDto } from './ficha-alerta.dto';
import { OmitType } from '@nestjs/mapped-types';

export class DireccionInicialAlertaDto {
  @IsOptional() @IsString() @MaxLength(200) departamento?: string;
  @IsOptional() @IsString() @MaxLength(200) municipio?: string;
  @IsOptional() @IsString() @MaxLength(1000) direccionDetallada?: string;
}
export class DenuncianteInicialAlertaDto {
  @IsOptional() @IsString() @MaxLength(500) nombre?: string;
  @IsOptional() @IsString() @MaxLength(30) cui?: string;
  @IsOptional() @IsString() @MaxLength(50) telefono?: string;
}
export class CompletarAlertaDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(500) nombreDesaparecido?: string;
  @IsOptional() @Matches(/^M0030-\d{4}-\d+$/) numeroMp?: string;
  @IsOptional() @Matches(/^\d+-\d{4}$/) numeroAlerta?: string;
  @IsOptional() @IsDateString() fecha_Nac?: string;
  @IsOptional() @IsIn(['Informado', 'Concluido', 'Remitido']) estadoInvestigacion?: string;
  @IsOptional() @IsString() @MaxLength(200) origenAlerta?: string;
  @IsOptional() @IsString() @MaxLength(500) casaHogar?: string;
  @IsOptional() @IsString() @MaxLength(100) ubicacionGps?: string;
  @IsOptional() @ValidateNested() @Type(() => DireccionInicialAlertaDto) direccion?: DireccionInicialAlertaDto;
  @IsOptional() @ValidateNested() @Type(() => DenuncianteInicialAlertaDto) denunciante?: DenuncianteInicialAlertaDto;
  @IsOptional() @ValidateNested() @Type(() => FichaAlertaDto) fichaAlerta?: FichaAlertaDto;
  @IsOptional() @IsDateString() fechaLocalizacion?: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) horaLocalizacion?: string;
  @IsOptional() @IsString() @MaxLength(1000) direccionLocalizacion?: string;
  @IsOptional() @IsString() @MaxLength(500) nombreAcompanante?: string;
  @IsOptional() @IsString() @MaxLength(50) telefono?: string;
}
export class RegistroInicialAlertaDto extends OmitType(CompletarAlertaDto, ['nombreDesaparecido'] as const) {
  @IsString() @IsNotEmpty() @Matches(/^DEIC52-\d{4}-\d{2}-\d{2}-\d+$/) numeroDeic: string;
  @IsString() @IsNotEmpty() @MaxLength(500) nombreDesaparecido: string;
  @IsDateString() fechaIngreso: string;
  @IsMongoId() investigadorAsignado: string;
}
