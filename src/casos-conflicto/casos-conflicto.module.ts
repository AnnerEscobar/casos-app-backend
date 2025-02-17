import { Module } from '@nestjs/common';
import { CasosConflictoService } from './casos-conflicto.service';
import { CasosConflictoController } from './casos-conflicto.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { CasosConflicto, CasosConflictoSchema } from './entities/casos-conflicto.entity';
import { GoogleApiService } from 'src/google-api/google-api.service';

@Module({
  controllers: [CasosConflictoController],
  providers: [CasosConflictoService, GoogleApiService],
  imports: [
    MongooseModule.forFeature([
      { name: CasosConflicto.name, schema: CasosConflictoSchema },
    ]),
  ],
})
export class CasosConflictoModule {}
