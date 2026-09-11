import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

import {
  CasosAlerta,
  CasosAlertaSchema
} from '../casos-alerta/entities/casos-alerta.entity';

import {
  CasosMaltrato,
  CasosMaltratoSchema
} from '../casos-maltrato/entities/casos-maltrato.entity';

import {
  CasosConflicto,
  CasosConflictoSchema
} from '../casos-conflicto/entities/casos-conflicto.entity';


@Module({

  imports: [

    MongooseModule.forFeature([

      {
        name: CasosAlerta.name,
        schema: CasosAlertaSchema
      },

      {
        name: CasosMaltrato.name,
        schema: CasosMaltratoSchema
      },

      {
        name: CasosConflicto.name,
        schema: CasosConflictoSchema
      }

    ])

  ],

  controllers: [
    DashboardController
  ],

  providers: [
    DashboardService
  ]

})
export class DashboardModule {}