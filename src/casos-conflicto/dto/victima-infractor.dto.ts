import { Type } from "class-transformer";
import { IsDate, IsNotEmpty, IsString } from "class-validator";

export class victimaInfractorDto{

    @IsString()
    nombre: string;

    @IsString()
    cui: string;

    @IsString()
    direccion: string;

    @IsDate()
    @Type(() => Date)
    fecha_Nac: Date;


}