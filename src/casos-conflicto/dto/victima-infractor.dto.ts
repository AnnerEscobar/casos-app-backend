import { Type } from "class-transformer";
import { IsDate, IsNotEmpty, IsString } from "class-validator";

export class victimaInfractorDto{

    @IsString()
    @IsNotEmpty()
    nombre: string;

    @IsString()
    @IsNotEmpty()
    cui: string;

    @IsString()
    @IsNotEmpty()
    direccion: string;

    @IsDate()
    @Type(() => Date)
    fecha_Nac: Date;


}