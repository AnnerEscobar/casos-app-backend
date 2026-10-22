import {
  IsDate,
  IsEnum,
  IsOptional,
  IsMongoId,
  IsString,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';


/* ======================================================
   DATOS DE CARÁTULA
====================================================== */

export class DatosCaratulaDto {

  @IsString()
  @IsOptional()
  numeroMp?: string;


  /*
   * Solo aplica para Alerta Alba-Keneth.
   */
  @IsString()
  @IsOptional()
  numeroAlerta?: string;


  @IsString()
  nombre: string;


  @IsString()
  @IsOptional()
  edad?: string;


  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaNac?: Date;


  @IsString()
  lugar: string;


  @IsString()
  @IsOptional()
  departamento?: string;


  @IsString()
  @IsOptional()
  municipio?: string;


  @IsString()
  @IsOptional()
  observaciones?: string;
}


/* ======================================================
   CREAR DOCUMENTACIÓN INICIAL
====================================================== */

export class CreateDocumentacionInicialDto {
  @IsOptional()
  @IsMongoId()
  casoId?: string;

  @IsEnum(['Alerta', 'Maltrato', 'Conflicto'])
  tipoCaso: 'Alerta' | 'Maltrato' | 'Conflicto';


  /*
   * DEIC se captura una sola vez en el Paso 1
   * y después será reutilizado por Plan y Rúbrica.
   */
  @IsString()
  numeroDeic: string;


  /*
   * Solo aplica si el tipo es Maltrato.
   *
   * Puede dejarse vacío inicialmente y definirse
   * antes de generar la rúbrica.
   */
  @IsOptional()
  @IsEnum(['OFICIO', 'REQUERIMIENTO'])
  modalidadMaltrato?: 'OFICIO' | 'REQUERIMIENTO';


  /*
   * Información utilizada para generar la carátula.
   */
  @ValidateNested()
  @Type(() => DatosCaratulaDto)
  caratula: DatosCaratulaDto;
}
