import { Test, TestingModule } from '@nestjs/testing';
import { ProcedimientosService } from './procedimientos.service';

describe('ProcedimientosService', () => {
  let service: ProcedimientosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProcedimientosService],
    }).compile();

    service = module.get<ProcedimientosService>(ProcedimientosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
