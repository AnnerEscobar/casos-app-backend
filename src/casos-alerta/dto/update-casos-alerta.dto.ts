import { PartialType } from '@nestjs/mapped-types';
import { CreateCasosAlertaDto } from './create-casos-alerta.dto';

export class UpdateCasosAlertaDto extends PartialType(CreateCasosAlertaDto) {}
