import { Module } from '@nestjs/common';
import { CasosAlertaService } from './casos-alerta.service';
import { CasosAlertaController } from './casos-alerta.controller';

@Module({
  controllers: [CasosAlertaController],
  providers: [CasosAlertaService],
})
export class CasosAlertaModule {}
