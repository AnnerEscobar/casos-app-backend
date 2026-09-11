import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ResponsableSeguimientoDto {
  @IsOptional() @IsMongoId() investigadorAsignado?: string;
}

export class SeguimientoDto extends ResponsableSeguimientoDto {
  @IsString() @IsNotEmpty() estadoInvestigacion: string;
}
