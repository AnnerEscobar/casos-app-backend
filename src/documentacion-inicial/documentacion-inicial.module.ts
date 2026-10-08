import { Module } from '@nestjs/common';

import {
  MongooseModule,
} from '@nestjs/mongoose';

import {
  DocumentacionInicial,
  DocumentacionInicialSchema,
} from './entities/documentacion-inicial.entity';

import {
  DocumentacionInicialController,
} from './documentacion-inicial.controller';

import {
  DocumentacionInicialService,
} from './documentacion-inicial.service';


@Module({

  imports: [

    MongooseModule.forFeature([
      {
        name:
          DocumentacionInicial.name,

        schema:
          DocumentacionInicialSchema,
      },
    ]),

  ],

  controllers: [
    DocumentacionInicialController,
  ],

  providers: [
    DocumentacionInicialService,
  ],

  /*
   * Lo exportamos porque posteriormente los módulos
   * Alerta, Maltrato y Conflicto necesitarán cambiar
   * la documentación a EN_REVISION / REGISTRADO.
   */
  exports: [
    DocumentacionInicialService,
  ],

})
export class DocumentacionInicialModule {}