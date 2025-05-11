import { Module } from '@nestjs/common';
import { CaratulasService } from './caratulas.service';
import { CaratulasController } from './caratulas.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Caratula, CaratulaSchema } from './entities/caratula.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Caratula.name, schema: CaratulaSchema }
    ])
  ],
  controllers: [CaratulasController],
  providers: [CaratulasService],
})
export class CaratulasModule {}
