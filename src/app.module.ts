import { Module } from '@nestjs/common';
import { CasosAlertaModule } from './casos-alerta/casos-alerta.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGO_URI),
    CasosAlertaModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
