import { Test, TestingModule } from '@nestjs/testing';
import { CasosMaltratoController } from './casos-maltrato.controller';
import { CasosMaltratoService } from './casos-maltrato.service';

describe('CasosMaltratoController', () => {
  let controller: CasosMaltratoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CasosMaltratoController],
      providers: [CasosMaltratoService],
    }).compile();

    controller = module.get<CasosMaltratoController>(CasosMaltratoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
