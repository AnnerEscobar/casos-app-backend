import { IsString, IsNotEmpty, IsOptional, IsDate, IsObject, Matches, IsEmpty, IsArray, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCasosAlertaDto {

    @IsString()
    @IsNotEmpty()
    @Matches(/^DEIC52-\d{4}-\d{2}-\d{2}-\d+$/, {
        message: 'El numero Deic debe seguir el formato DEIC52-AAAA-MM-DD-XXX'
    })
    numeroDeic: string;


    @IsString()
    @IsNotEmpty()
    @Matches(/^M0030-\d{4}-\d+$/, {
        message: 'El numero Mp, debe seguir el formato M0030-AAAA-XXX-'
    })
    numeroMp: string;


    @IsString()
    @IsNotEmpty()
    @Matches(/^\d+-\d{4}$/, {
        message: 'El numero de alerta, debe seguir el formato XXXX-AAAA'
    })
    numeroAlerta: string;


    @IsString()
    @IsNotEmpty()
    nombreDesaparecido: string;


    @IsDate()
    @Type(() => Date)
    fecha_Nac: Date;


    @IsString()
    @IsNotEmpty()
    estadoInvestigacion: string;


    @IsObject()
    direccion: {
        departamento: string;
        municipio: string;
        direccionDetallada: string;
    };

    @IsOptional()
    @IsString()
    fileUrls: string;

    @IsOptional()
    @IsString()
    direccionLocalizacion?: string;

    @IsOptional()
    @IsString()
    nombreAcompanante?: string;

    @IsOptional()
    @IsString()
    telefono?: string;

    @IsOptional()
    @IsString()
    horaLocalizacion?: string;

    @IsOptional()
    @IsDate()
    @Type(() => Date)
    fechaLocalizacion?: Date;


}
