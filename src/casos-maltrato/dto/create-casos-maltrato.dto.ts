import { Type } from "class-transformer";
import { IsArray, IsOptional, IsString, Matches, ValidateNested } from "class-validator";
import { victimaInfractorDto } from "src/casos-conflicto/dto/victima-infractor.dto";

export class CreateCasosMaltratoDto {
    @IsString()
    @Matches(/^DEIC51-\d{4}-\d{2}-\d{2}-\d+$/, {
        message: 'El numero Deic debe seguir el formato DEIC51-AAAA-MM-DD-XXX'
    })
    @IsOptional()
    numeroDeic: string;


@IsString()
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
