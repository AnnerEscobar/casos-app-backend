import { Test, TestingModule } from '@nestjs/testing';
import { CasosConflictoController } from './casos-conflicto.controller';
import { CasosConflictoService } from './casos-conflicto.service';

describe('CasosConflictoController', () => {
  let controller: CasosConflictoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CasosConflictoController],
      providers: [CasosConflictoService],
    }).compile();

    controller = module.get<CasosConflictoController>(CasosConflictoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
