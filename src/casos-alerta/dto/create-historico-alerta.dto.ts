import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CasoHistoricoDto, JsonHistorico } from '../../common/historicos/caso-historico.dto';
import { DenuncianteDto } from './denunciante.dto';
import { LugarDesaparicionDto } from './lugar-desaparicion.dto';
import { DatosLocalizacionDto } from './datos-localizacion.dto';

class DenuncianteHistoricoDto extends PartialType(DenuncianteDto) {}
class LugarHistoricoDto extends PartialType(LugarDesaparicionDto) {}
class LocalizacionHistoricaDto extends PartialType(DatosLocalizacionDto) {}

export class CreateHistoricoAlertaDto extends CasoHistoricoDto {
  @IsOptional() @IsString() @IsNotEmpty() numeroAlerta?: string;
  @IsOptional() @IsString() @IsNotEmpty() nombreDesaparecido?: string;
  @IsOptional() @IsString() @IsNotEmpty() origenAlerta?: string;
  @IsOptional() @IsString() @IsNotEmpty() casaHogar?: string;
  @IsOptional() @IsString() @IsNotEmpty() ubicacionGps?: string;
  @IsOptional() @IsDate() @Type(() => Date) fecha_Nac?: Date;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => DenuncianteHistoricoDto) @JsonHistorico(() => DenuncianteHistoricoDto) denunciante?: DenuncianteHistoricoDto;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => LugarHistoricoDto) @JsonHistorico(() => LugarHistoricoDto) lugarDesaparicion?: LugarHistoricoDto;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => LocalizacionHistoricaDto) @JsonHistorico(() => LocalizacionHistoricaDto) datosLocalizacion?: LocalizacionHistoricaDto;
}
