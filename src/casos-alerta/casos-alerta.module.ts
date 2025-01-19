import { Module } from '@nestjs/common';
import { CasosAlertaService } from './casos-alerta.service';
import { CasosAlertaController } from './casos-alerta.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { CasosAlerta, CasosAlertaSchema } from './entities/casos-alerta.entity';
import { GoogleApiService } from 'src/google-api/google-api.service';

@Module({
  controllers: [CasosAlertaController],
  providers: [CasosAlertaService, GoogleApiService],
  imports:[
    MongooseModule.forFeature([
      {name: CasosAlerta.name, schema: CasosAlertaSchema}
    ]),
  ],
})
export class CasosAlertaModule {

}
