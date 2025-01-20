import { PartialType } from '@nestjs/swagger';
import { CreateCasosMaltratoDto } from './create-casos-maltrato.dto';

export class UpdateCasosMaltratoDto extends PartialType(CreateCasosMaltratoDto) {}
