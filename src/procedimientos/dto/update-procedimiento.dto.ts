import { PartialType } from '@nestjs/swagger';
import { CreateProcedimientoDto } from './create-procedimiento.dto';

export class UpdateProcedimientoDto extends PartialType(CreateProcedimientoDto) {}
