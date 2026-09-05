import { IsString, MinLength } from 'class-validator';

export class RechazarRegistroDto {

  @IsString()
  @MinLength(25, {
    message: 'El motivo del rechazo debe contener al menos 5 caracteres',
  })
  motivo: string;
}