import { Test, TestingModule } from '@nestjs/testing';
import { CasosMaltratoService } from './casos-maltrato.service';

describe('CasosMaltratoService', () => {
  let service: CasosMaltratoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CasosMaltratoService],
    }).compile();

    service = module.get<CasosMaltratoService>(CasosMaltratoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
