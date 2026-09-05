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
  victimaInfractorDto
} from './victima-infractor.dto';

import {
  LugarHechosDto
} from './lugar-hechos.dto';


export class CreateCasosConflictoDto {

  /* =====================================================
     NÚMERO DEIC
  ===================================================== */

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @Matches(
    /^(?:DEIC53-\d{4}-\d{2}-\d{2}-\d+|AC\d{6})$/,
    {
      message:
        'El numero Deic debe seguir el formato DEIC53-AAAA-MM-DD-XXX o historico AC000001'
    }
  )
  numeroDeic: string;


  /* =====================================================
     NÚMERO MP
  ===================================================== */

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @Matches(
    /^(?:M0004|MP001|MPE01)-\d{4}-\d+$/,
    {
      message:
        'El numero MP debe seguir el formato M0004-AAAA-XXX, MP001-AAAA-XXX o MPE01-AAAA-XXX'
    }
  )
  numeroMp: string;


  /* =====================================================
     ESTADO DE INVESTIGACIÓN
  ===================================================== */

  @IsDefined()
  @IsString()
  @IsNotEmpty()
  estadoInvestigacion: string;


  /* =====================================================
     INFRACTORES
  ===================================================== */

  @Transform(({ value }) => {

    if (typeof value === 'string') {

      const parsed =
        JSON.parse(value);

      return parsed.map(
        (persona: any) =>
          plainToInstance(
            victimaInfractorDto,
            persona
          )
      );

    }

    return value;

  })

  @IsDefined()
  @IsArray()
  @ArrayMinSize(
    1,
    {
      message:
        'Debe registrar al menos un infractor'
    }
  )
  @ValidateNested({
    each: true
  })
  @Type(
    () => victimaInfractorDto
  )
  infractores:
    victimaInfractorDto[];


  /* =====================================================
     VÍCTIMAS
  ===================================================== */

  @Transform(({ value }) => {

    if (typeof value === 'string') {

      const parsed =
        JSON.parse(value);

      return parsed.map(
        (persona: any) =>
          plainToInstance(
            victimaInfractorDto,
            persona
          )
      );

    }

    return value;

  })

  @IsDefined()
  @IsArray()
  @ArrayMinSize(
    1,
    {
      message:
        'Debe registrar al menos una víctima'
    }
  )
  @ValidateNested({
    each: true
  })
  @Type(
    () => victimaInfractorDto
  )
  victimas:
    victimaInfractorDto[];


  /* =====================================================
     LUGAR DE LOS HECHOS
  ===================================================== */

  @Transform(({ value }) => {

    if (
      typeof value === 'string'
    ) {

      return plainToInstance(
        LugarHechosDto,
        JSON.parse(value)
      );

    }

    return value;

  })

  @IsDefined()
  @ValidateNested()
  @Type(
    () => LugarHechosDto
  )
  lugarHechos:
    LugarHechosDto;

}