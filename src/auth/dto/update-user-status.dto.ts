import { IsBoolean } from 'class-validator';

export class UpdateUserStatusDto {

  @IsBoolean()
  activo: boolean;

}