import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsArray, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { CasoHistoricoDto, JsonHistorico } from '../../common/historicos/caso-historico.dto';
import { PersonaMaltratoDto } from './persona-maltrato.dto';
import { LugarHechosDto } from './lugar-hechos.dto';

class PersonaHistoricaDto extends PartialType(PersonaMaltratoDto) {}
class LugarHistoricoDto extends PartialType(LugarHechosDto) {}

export class CreateHistoricoMaltratoDto extends CasoHistoricoDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PersonaHistoricaDto) @JsonHistorico(() => PersonaHistoricaDto) victimas?: PersonaHistoricaDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PersonaHistoricaDto) @JsonHistorico(() => PersonaHistoricaDto) sindicados?: PersonaHistoricaDto[];
  @IsOptional() @IsObject() @ValidateNested() @Type(() => LugarHistoricoDto) @JsonHistorico(() => LugarHistoricoDto) lugarHechos?: LugarHistoricoDto;
}
