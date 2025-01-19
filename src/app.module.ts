import { Module } from '@nestjs/common';
import { CasosAlertaModule } from './casos-alerta/casos-alerta.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { GoogleApiModule } from './google-api/google-api.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGO_URI),
    CasosAlertaModule,
    GoogleApiModule
  ],
  controllers: [],
  providers: [],
})


export class AppModule {}
