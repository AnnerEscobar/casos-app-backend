import { Module } from '@nestjs/common';
import { CasosAlertaService } from './casos-alerta.service';
import { CasosAlertaController } from './casos-alerta.controller';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  controllers: [CasosAlertaController],
  providers: [CasosAlertaService],
  imports:[
    MulterModule.register({
      dest: './uploads'
    }),
  ],
})
export class CasosAlertaModule {

}
