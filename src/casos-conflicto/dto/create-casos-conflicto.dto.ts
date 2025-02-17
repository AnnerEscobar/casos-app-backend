import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsOptional, IsString, Matches, ValidateNested } from "class-validator";
import { victimaInfractorDto } from "./victima-infractor.dto";

export class CreateCasosConflictoDto {

    @IsString()
    @Matches(/^DEIC53-\d{4}-\d{2}-\d{2}-\d+$/, {
        message: 'El numero Deic debe seguir el formato DEIC53-AAAA-MM-DD-XXX'
    })
    @IsOptional()
    numeroDeic: string;


    @IsString()
    @Matches(/^M0030-\d{4}-\d+$/, {
        message: 'El numero Mp, debe seguir el formato M0030-AAAA-XXX-'
    })
    @IsOptional()
    numeroMp: string;


    @IsString()
    @IsOptional()
    estadoInvestigacion: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => victimaInfractorDto)
    @IsOptional()
    infractores: victimaInfractorDto[];
  
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => victimaInfractorDto)
    @IsOptional()
    victimas: victimaInfractorDto[];

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    fileUrls: string[];


}


