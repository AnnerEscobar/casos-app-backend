import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InformesController } from './informes.controller';
import { InformesService } from './informes.service';
import { Informe, InformeSchema } from './entities/informe.entity';
import { GoogleApiService } from 'src/google-api/google-api.service';
import { InformeWordService } from './informe-word.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Informe.name, schema: InformeSchema }
    ])
  ],
  controllers: [InformesController],
  providers: [InformesService, GoogleApiService, InformeWordService],
  exports: [InformesService]
})
export class InformesModule {}