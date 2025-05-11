import { PartialType } from '@nestjs/swagger';
import { CreateCaratulaDto } from './create-caratula.dto';

export class UpdateCaratulaDto extends PartialType(CreateCaratulaDto) {}
