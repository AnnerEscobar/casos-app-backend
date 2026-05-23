import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsOptional, IsString, Matches, ValidateNested } from "class-validator";
import { victimaInfractorDto } from "./victima-infractor.dto";

export class CreateCasosConflictoDto {

    @IsString()
    @Matches(/^(?:DEIC53-\d{4}-\d{2}-\d{2}-\d+|AC\d{6})$/, {
        message: 'El numero Deic debe seguir el formato DEIC53-AAAA-MM-DD-XXX o historico AC000001'
    })
    @IsOptional()
    numeroDeic: string;


    @IsString()
    @Matches(/^(?:M0004|MP001|MPE01)-\d{4}-\d+$/, {
        message: 'El numero MP debe seguir el formato M0004-AAAA-XXX, MP001-AAAA-XXX o MPE01-AAAA-XXX'
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


