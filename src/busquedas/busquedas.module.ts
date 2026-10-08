import { BusquedaAccesoService } from './busqueda-acceso.service';
import { SolicitudAcceso, SolicitudAccesoSchema } from './solicitud-acceso.schema';
import { Module } from '@nestjs/common';
import { BusquedasService } from './busquedas.service';
import { BusquedasController } from './busquedas.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { CasosMaltrato, CasosMaltratoSchema } from 'src/casos-maltrato/entities/casos-maltrato.entity';
import { CasosConflicto, CasosConflictoSchema } from 'src/casos-conflicto/entities/casos-conflicto.entity';
import { CasosAlerta, CasosAlertaSchema } from 'src/casos-alerta/entities/casos-alerta.entity';

@Module({
  controllers: [BusquedasController],
  providers: [BusquedasService, BusquedaAccesoService],
  imports: [
    MongooseModule.forFeature([
      { name: SolicitudAcceso.name, schema: SolicitudAccesoSchema },
      { name: CasosAlerta.name, schema: CasosAlertaSchema },
      { name: CasosMaltrato.name, schema: CasosMaltratoSchema },
      { name: CasosConflicto.name, schema: CasosConflictoSchema },
    ]),
  ],
})
export class BusquedasModule {}
