import { Test, TestingModule } from '@nestjs/testing';
import { CasosConflictoService } from './casos-conflicto.service';

describe('CasosConflictoService', () => {
  let service: CasosConflictoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CasosConflictoService],
    }).compile();

    service = module.get<CasosConflictoService>(CasosConflictoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
