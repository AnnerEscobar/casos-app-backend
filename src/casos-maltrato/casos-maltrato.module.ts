import { Module } from '@nestjs/common';
import { CasosMaltratoService } from './casos-maltrato.service';
import { CasosMaltratoController } from './casos-maltrato.controller';
import { GoogleApiService } from 'src/google-api/google-api.service';
import { CasosMaltrato, CasosMaltratoSchema } from './entities/casos-maltrato.entity';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  controllers: [CasosMaltratoController],
  providers: [CasosMaltratoService, GoogleApiService],
   imports: [
      MongooseModule.forFeature([
        { name: CasosMaltrato.name, schema: CasosMaltratoSchema },
      ]),
    ],
})
export class CasosMaltratoModule {}
