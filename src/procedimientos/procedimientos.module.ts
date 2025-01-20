import { Module } from '@nestjs/common';
import { ProcedimientosService } from './procedimientos.service';
import { ProcedimientosController } from './procedimientos.controller';

@Module({
  controllers: [ProcedimientosController],
  providers: [ProcedimientosService],
})
export class ProcedimientosModule {}
