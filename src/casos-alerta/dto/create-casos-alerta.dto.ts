import { plainToInstance, Transform, Type } from 'class-transformer';

import {
    IsDate,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    ValidateNested
} from 'class-validator';

import { LugarDesaparicionDto } from './lugar-desaparicion.dto';
import { DenuncianteDto } from './denunciante.dto';
import { DatosLocalizacionDto } from './datos-localizacion.dto';


export class CreateCasosAlertaDto {

    @IsString()
    @IsNotEmpty()
    @Matches(/^DEIC52-\d{4}-\d{2}-\d{2}-\d+$/, {
        message:
            'El numero Deic debe seguir el formato DEIC52-AAAA-MM-DD-XXX'
    })
    numeroDeic: string;


    @IsString()
    @IsNotEmpty()
    @Matches(/^M0030-\d{4}-\d+$/, {
        message:
            'El numero Mp debe seguir el formato M0030-AAAA-XXX'
    })
    numeroMp: string;


    @IsString()
    @IsNotEmpty()
    @Matches(/^\d+-\d{4}$/, {
        message:
            'El numero de alerta debe seguir el formato XXXX-AAAA'
    })
    numeroAlerta: string;


    // DESAPARECIDO

    @IsString()
    @IsNotEmpty()
    nombreDesaparecido: string;


    @IsDate()
    @Type(() => Date)
    fecha_Nac: Date;


    @IsString()
    @IsNotEmpty()
    estadoInvestigacion: string;


    // DENUNCIANTE

    @Transform(({ value }) => {

  const parsed =
    typeof value === 'string'
      ? JSON.parse(value)
      : value;

  return plainToInstance(
    DenuncianteDto,
    parsed
  );
})
@ValidateNested()
denunciante: DenuncianteDto;


    // LUGAR DE LA DESAPARICIÓN

    @Transform(({ value }) => {

  const parsed =
    typeof value === 'string'
      ? JSON.parse(value)
      : value;

  return plainToInstance(
    LugarDesaparicionDto,
    parsed
  );
})
@ValidateNested()
lugarDesaparicion: LugarDesaparicionDto;


    @IsOptional()
    @IsString()
    origenAlerta?: string;


    @IsOptional()
    @IsString()
    casaHogar?: string;


    @IsOptional()
    @IsString()
    ubicacionGps?: string;


   @IsOptional()
@Transform(({ value }) => {

  const parsed =
    typeof value === 'string'
      ? JSON.parse(value)
      : value;

  return plainToInstance(
    DatosLocalizacionDto,
    parsed
  );
})
@ValidateNested()
datosLocalizacion?: DatosLocalizacionDto;
}