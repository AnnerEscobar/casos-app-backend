import { Module } from '@nestjs/common';
import { CasosConflictoService } from './casos-conflicto.service';
import { CasosConflictoController } from './casos-conflicto.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { CasosConflicto, CasosConflictoSchema } from './entities/casos-conflicto.entity';

@Module({
  controllers: [CasosConflictoController],
  providers: [CasosConflictoService],
  imports: [
    MongooseModule.forFeature([
      { name: CasosConflicto.name, schema: CasosConflictoSchema },
    ]),
  ],
})
export class CasosConflictoModule {}
