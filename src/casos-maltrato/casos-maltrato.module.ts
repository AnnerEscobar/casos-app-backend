import { Module } from '@nestjs/common';
import { CasosMaltratoService } from './casos-maltrato.service';
import { CasosMaltratoController } from './casos-maltrato.controller';

@Module({
  controllers: [CasosMaltratoController],
  providers: [CasosMaltratoService],
})
export class CasosMaltratoModule {}
