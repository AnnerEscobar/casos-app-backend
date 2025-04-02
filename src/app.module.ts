import { Module } from '@nestjs/common';
import { CasosAlertaModule } from './casos-alerta/casos-alerta.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { GoogleApiModule } from './google-api/google-api.module';
import { CasosMaltratoModule } from './casos-maltrato/casos-maltrato.module';
import { CasosConflictoModule } from './casos-conflicto/casos-conflicto.module';
import { ProcedimientosModule } from './procedimientos/procedimientos.module';
import { BusquedasModule } from './busquedas/busquedas.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGO_URI),
    CasosAlertaModule,
    GoogleApiModule,
    CasosMaltratoModule,
    CasosConflictoModule,
    ProcedimientosModule,
    BusquedasModule,
    AuthModule,
    UsersModule
  ],
  controllers: [],
  providers: [],
})


export class AppModule {}
