import { Type } from 'class-transformer';
import { IsOptional, IsString, IsInt, Min, Max, IsDateString, Matches, MaxLength } from 'class-validator';

export class FichaAlertaDto {
  @IsOptional() @IsString() @MaxLength(500)
  delegacion?: string;
  @IsOptional() @IsString() @MaxLength(500)
  tipoAlerta?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(130)
  edadReportada?: number;
  @IsOptional() @IsString() @MaxLength(500)
  sexo?: string;
  @IsOptional() @IsString() @MaxLength(500)
  etnia?: string;
  @IsOptional() @IsString() @MaxLength(500)
  comunidadLgbtiq?: string;
  @IsOptional() @IsString() @MaxLength(500)
  discapacidad?: string;
  @IsOptional() @IsString() @MaxLength(500)
  nacionalidad?: string;
  @IsOptional() @IsString() @MaxLength(500)
  profesion?: string;
  @IsOptional() @IsString() @MaxLength(10000)
  caracteristicasFisicas?: string;
  @IsOptional() @IsString() @MaxLength(10000)
  vestimenta?: string;
  @IsOptional() @IsString() @MaxLength(500)
  presuntoResponsable?: string;
  @IsOptional() @IsString() @MaxLength(500)
  relacionResponsable?: string;
  @IsOptional() @IsDateString()
  fechaDesaparicion?: string;
  @IsOptional() @IsString() @MaxLength(500) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  horaDesaparicion?: string;
  @IsOptional() @IsString() @MaxLength(500)
  referenciaLugar?: string;
  @IsOptional() @IsString() @MaxLength(500)
  sector?: string;
  @IsOptional() @IsString() @MaxLength(500)
  zonaDesaparicion?: string;
  @IsOptional() @IsString() @MaxLength(500)
  tipoLugar?: string;
  @IsOptional() @IsString() @MaxLength(500)
  motivoDesaparicion?: string;
  @IsOptional() @IsString() @MaxLength(10000)
  resenaDesaparicion?: string;
  @IsOptional() @IsString() @MaxLength(500)
  estatusLocalizacion?: string;
  @IsOptional() @IsString() @MaxLength(500)
  unidadLocalizo?: string;
  @IsOptional() @IsString() @MaxLength(500)
  institucionLocalizo?: string;
  @IsOptional() @IsString() @MaxLength(500)
  condicionLocalizacion?: string;
  @IsOptional() @IsString() @MaxLength(500)
  causaFallecimiento?: string;
  @IsOptional() @IsString() @MaxLength(500)
  departamentoLocalizacion?: string;
  @IsOptional() @IsString() @MaxLength(500)
  municipioLocalizacion?: string;
  @IsOptional() @IsString() @MaxLength(500)
  zonaLocalizacion?: string;
  @IsOptional() @IsString() @MaxLength(10000)
  resenaLocalizacion?: string;
  @IsOptional() @IsDateString()
  fechaInformado?: string;
  @IsOptional() @IsString() @MaxLength(500)
  numeroOficio?: string;
  @IsOptional() @IsString() @MaxLength(500)
  institucionDestinataria?: string;
  @IsOptional() @IsString() @MaxLength(500)
  clasificacionCaso?: string;
  @IsOptional() @IsString() @MaxLength(500)
  situacionAlerta?: string;
  @IsOptional() @IsDateString()
  fechaDesactivacion?: string;
  @IsOptional() @IsDateString()
  fechaEntregaAnalisis?: string;
  @IsOptional() @IsString() @MaxLength(10000)
  observaciones?: string;
  @IsOptional() @IsString() @MaxLength(10000)
  observacionesAnalista?: string;
  @IsOptional() @IsString() @MaxLength(10000)
  observacionesAdicionales?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000)
  camarasUbicadas?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000)
  camarasSolicitadas?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000)
  videosExtraidos?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000)
  fotogramas?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000)
  inmueblesUbicados?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000)
  allanamientosSolicitados?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000)
  allanamientosEjecutados?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000)
  allanamientosNoAutorizados?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000)
  solvenciasPersonas?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000)
  perfilacionesPersonas?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000)
  aprehensionesSolicitadas?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000)
  aprehensionesEjecutadas?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000)
  aprehensionesNoAutorizadas?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000)
  solvenciasVehiculos?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000)
  fichasVehiculos?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000)
  incautado?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000)
  entrevistas?: number;
}
