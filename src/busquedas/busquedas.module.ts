import { Module } from '@nestjs/common';
import { BusquedasService } from './busquedas.service';
import { BusquedasController } from './busquedas.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { CasosMaltrato, CasosMaltratoSchema } from 'src/casos-maltrato/entities/casos-maltrato.entity';
import { CasosConflicto, CasosConflictoSchema } from 'src/casos-conflicto/entities/casos-conflicto.entity';
import { CasosAlerta, CasosAlertaSchema } from 'src/casos-alerta/entities/casos-alerta.entity';

@Module({
  controllers: [BusquedasController],
  providers: [BusquedasService],
  imports: [
    MongooseModule.forFeature([
      { name: CasosAlerta.name, schema: CasosAlertaSchema },
      { name: CasosMaltrato.name, schema: CasosMaltratoSchema },
      { name: CasosConflicto.name, schema: CasosConflictoSchema },
    ]),
  ],
})
export class BusquedasModule {}
