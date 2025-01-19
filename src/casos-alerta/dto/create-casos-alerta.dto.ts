import { IsString, IsNotEmpty, IsOptional, IsDate, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCasosAlertaDto {

    @IsString()
    @IsNotEmpty()
    numeroDeic: string;

    @IsString()
    @IsNotEmpty()
    numeroMp: string;

    @IsString()
    @IsNotEmpty()
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
    fileUrls: string; // Aquí almacenaremos la URL del archivo en Google Drive

}
