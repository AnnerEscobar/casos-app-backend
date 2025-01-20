import { PartialType } from '@nestjs/swagger';
import { CreateCasosConflictoDto } from './create-casos-conflicto.dto';

export class UpdateCasosConflictoDto extends PartialType(CreateCasosConflictoDto) {}
