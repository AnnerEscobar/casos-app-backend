import { BadRequestException } from '@nestjs/common';
import { Type, Transform, plainToInstance, ClassConstructor } from 'class-transformer';
import { Equals, IsEnum, IsInt, IsMongoId, IsNotEmpty, IsObject, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { normalizeCaseNumber } from '../case-number.validator';
import { EstadoExpedienteHistorico, FuenteInformacionHistorica, OrigenCaso } from './caso-historico.schema';

// Los formularios normales envían objetos/arreglos como JSON en multipart.
// Conserva también las peticiones JSON históricas y su validación anidada.
export function JsonHistorico(tipo: () => ClassConstructor<object>): PropertyDecorator {
  return Transform(({ value, key }) => {
    if (typeof value !== 'string') return value;
    let parsed: unknown;
    try { parsed = JSON.parse(value); }
    catch { throw new BadRequestException(`El campo ${key} contiene JSON inválido.`); }
    return parsed !== null && typeof parsed === 'object' ? plainToInstance(tipo(), parsed) : parsed;
  }, { toClassOnly: true });
}

export class InvestigadorOriginalDto {
  @IsOptional() @IsMongoId() usuarioId?: string;
  @IsOptional() @IsString() @IsNotEmpty() nombre?: string;
}

export class CasoHistoricoDto {
  @IsString() @IsNotEmpty()
  @Transform(({ value }) => typeof value === 'string' ? normalizeCaseNumber(value) : value)
  numeroDeic: string;

  @IsOptional() @Equals(OrigenCaso.HISTORICO)
  origenCaso?: OrigenCaso.HISTORICO;

  @IsEnum(EstadoExpedienteHistorico)
  estadoExpedienteHistorico: EstadoExpedienteHistorico;

  @IsOptional() @IsEnum(FuenteInformacionHistorica)
  fuenteInformacionHistorica?: FuenteInformacionHistorica;

  @IsOptional() @IsString() observacionHistorica?: string;
  @Transform(({ value }) => typeof value === 'string' && value.trim() !== '' ? Number(value) : value)
  @IsOptional() @IsInt() @Min(1) @Max(9999) anioCaso?: number;
  @IsOptional() @IsString() @IsNotEmpty() numeroMp?: string;
  @IsOptional() @IsString() @IsNotEmpty() estadoInvestigacion?: string;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => InvestigadorOriginalDto) @JsonHistorico(() => InvestigadorOriginalDto)
  investigadorOriginal?: InvestigadorOriginalDto;
}
