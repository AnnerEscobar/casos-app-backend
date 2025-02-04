import { Type } from "class-transformer";
import { IsArray, IsDate, IsNotEmpty, IsObject, IsOptional, IsString, Matches, ValidateNested } from "class-validator";
import { victimaInfractorDto } from "./victima-infractor.dto";

export class CreateCasosConflictoDto {

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
    estadoInvestigacion: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => victimaInfractorDto)
    infractores: victimaInfractorDto[];
  
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => victimaInfractorDto)
    victimas: victimaInfractorDto[];

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    fileUrls: string[];


}


