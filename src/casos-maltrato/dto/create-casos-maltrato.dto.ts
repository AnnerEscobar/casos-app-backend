import {
  plainToInstance,
  Transform,
  Type
} from 'class-transformer';

import {
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsNotEmpty,
  IsString,
  Matches,
  ValidateNested
} from 'class-validator';

import {
  PersonaMaltratoDto
} from './persona-maltrato.dto';

import {
  LugarHechosDto
} from './lugar-hechos.dto';


export class CreateCasosMaltratoDto {


  // =====================================================
  // NÚMERO DEIC
  // =====================================================

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @Matches(
    /^DEIC51-\d{4}-\d{2}-\d{2}-\d+$/,
    {
      message:
        'El numero Deic debe seguir el formato DEIC51-AAAA-MM-DD-XXX'
    }
  )
  numeroDeic: string;


  // =====================================================
  // NÚMERO MP
  // =====================================================

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @Matches(
    /^(?:(?:MPE01|M0008|MP004|M0030|MP001)-\d{4}-\d+|IC\/PNCORLLAT\d+-\d{4}-\d+)$/,
    {
      message: `El numeroMp debe seguir uno de estos formatos:
MPE01-AAAA-NNN
M0008-AAAA-NNN
IC/PNCORLLATXXX-AAAA-NNN
MP004-AAAA-NNN
M0030-AAAA-NNN
MP001-AAAA-NNN`
    }
  )
  numeroMp: string;


  // =====================================================
  // ESTADO
  // =====================================================

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  estadoInvestigacion: string;


  // =====================================================
  // SINDICADOS
  // =====================================================

  @Transform(({ value }) => {

    const parsed =
      typeof value === 'string'
        ? JSON.parse(value)
        : value;

    if (!Array.isArray(parsed)) {
      return parsed;
    }

    return parsed.map(
      persona =>
        plainToInstance(
          PersonaMaltratoDto,
          persona
        )
    );

  })
  @IsDefined()
  @IsArray()
  @ArrayMinSize(1, {
    message:
      'Debe existir al menos un sindicado'
  })
  @ValidateNested({
    each: true
  })
  @Type(() => PersonaMaltratoDto)
  sindicados: PersonaMaltratoDto[];


  // =====================================================
  // VÍCTIMAS
  // =====================================================

  @Transform(({ value }) => {

    const parsed =
      typeof value === 'string'
        ? JSON.parse(value)
        : value;

    if (!Array.isArray(parsed)) {
      return parsed;
    }

    return parsed.map(
      persona =>
        plainToInstance(
          PersonaMaltratoDto,
          persona
        )
    );

  })
  @IsDefined()
  @IsArray()
  @ArrayMinSize(1, {
    message:
      'Debe existir al menos una víctima'
  })
  @ValidateNested({
    each: true
  })
  @Type(() => PersonaMaltratoDto)
  victimas: PersonaMaltratoDto[];


  // =====================================================
  // LUGAR DE LOS HECHOS
  // =====================================================

  @Transform(({ value }) => {

    const parsed =
      typeof value === 'string'
        ? JSON.parse(value)
        : value;

    return plainToInstance(
      LugarHechosDto,
      parsed
    );

  })
  @IsDefined()
  @ValidateNested()
  @Type(() => LugarHechosDto)
  lugarHechos: LugarHechosDto;

}