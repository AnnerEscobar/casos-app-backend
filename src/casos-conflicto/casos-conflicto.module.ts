import { Module } from '@nestjs/common';
import { CasosConflictoService } from './casos-conflicto.service';
import { CasosConflictoController } from './casos-conflicto.controller';

@Module({
  controllers: [CasosConflictoController],
  providers: [CasosConflictoService],
})
export class CasosConflictoModule {}
