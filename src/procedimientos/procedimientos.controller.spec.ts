import { Test, TestingModule } from '@nestjs/testing';
import { ProcedimientosController } from './procedimientos.controller';
import { ProcedimientosService } from './procedimientos.service';

describe('ProcedimientosController', () => {
  let controller: ProcedimientosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcedimientosController],
      providers: [ProcedimientosService],
    }).compile();

    controller = module.get<ProcedimientosController>(ProcedimientosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
