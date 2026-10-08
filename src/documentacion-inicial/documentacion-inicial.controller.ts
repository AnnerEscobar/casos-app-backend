import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';

import { DocumentacionInicialService } from './documentacion-inicial.service';

import { CreateDocumentacionInicialDto } from './dto/create-documentacion-inicial.dto';
import { UpdateCaratulaDocumentacionDto } from './dto/update-caratula-documentacion.dto';
import { UpdatePlanInvestigacionDto } from './dto/update-plan-investigacion.dto';
import { UpdateRubricaDto } from './dto/update-rubrica.dto';

import { JwtAuthGuard } from 'src/auth/Guards/jwt-auth.guard';

import { UserRole } from 'src/auth/enums/user-role.enum';


/* ======================================================
   USUARIO AUTENTICADO
====================================================== */

interface UsuarioAutenticado {

  userId: string;

  role: UserRole;

  nombre?: string;

  email?: string;
}


type RequestAutenticado =
  Request & {
    user?: UsuarioAutenticado;
  };


@Controller('documentacion-inicial')
@UseGuards(JwtAuthGuard)
export class DocumentacionInicialController {

  constructor(
    private readonly documentacionService:
      DocumentacionInicialService,
  ) {}


  /* ======================================================
     CREAR BORRADOR
  ====================================================== */

  @Post()
  async create(
    @Body()
    dto: CreateDocumentacionInicialDto,

    @Req()
    req: RequestAutenticado,
  ) {

    const usuario =
      this.getInvestigador(req);


    return this.documentacionService.create(

      dto,

      usuario.userId,

      usuario.nombre
        ?? usuario.email
        ?? 'Investigador',

    );
  }


  /* ======================================================
     TODOS MIS DOCUMENTOS
  ====================================================== */

  @Get('mis-documentos')
  async findMine(
    @Req()
    req: RequestAutenticado,
  ) {

    const usuario =
      this.getInvestigador(req);


    return this.documentacionService
      .findMine(
        usuario.userId,
      );
  }


  /* ======================================================
     MIS PENDIENTES PAGINADOS
  ====================================================== */

  @Get('pendientes')
  async findPendientes(
    @Req()
    req: RequestAutenticado,

    @Query('page')
    page = '1',

    @Query('limit')
    limit = '10',
  ) {

    const usuario =
      this.getInvestigador(req);


    const pageNumber =
      Number(page);

    const limitNumber =
      Number(limit);


    if (
      !Number.isFinite(pageNumber) ||
      pageNumber < 1
    ) {

      throw new BadRequestException(
        'La página no es válida.',
      );
    }


    if (
      !Number.isFinite(limitNumber) ||
      limitNumber < 1
    ) {

      throw new BadRequestException(
        'El límite no es válido.',
      );
    }


    const safeLimit =
      Math.min(
        limitNumber,
        100,
      );


    const skip =
      (pageNumber - 1) *
      safeLimit;


    const [
      items,
      total,
    ] =
      await Promise.all([

        this.documentacionService
          .findMisPendientesPaginated(
            usuario.userId,
            skip,
            safeLimit,
          ),

        this.documentacionService
          .countMisPendientes(
            usuario.userId,
          ),

      ]);


    return {

      items,

      pagination: {

        page:
          pageNumber,

        limit:
          safeLimit,

        total,

        totalPages:
          Math.ceil(
            total /
            safeLimit,
          ),

      },

    };
  }


  /* ======================================================
     HISTORIAL
  ====================================================== */

  @Get('historial')
  async findHistorial(
    @Req()
    req: RequestAutenticado,
  ) {

    const usuario =
      this.getInvestigador(req);


    return this.documentacionService
      .findMiHistorial(
        usuario.userId,
      );
  }


  /* ======================================================
     OBTENER DOCUMENTACIÓN
  ====================================================== */

  @Get(':id')
  async findOne(
    @Param('id')
    id: string,

    @Req()
    req: RequestAutenticado,
  ) {

    const usuario =
      this.getInvestigador(req);


    return this.documentacionService
      .findOne(
        id,
        usuario.userId,
      );
  }


  /* ======================================================
     PASO 1
     ACTUALIZAR CARÁTULA
  ====================================================== */

  @Patch(':id/caratula')
  async updateCaratula(
    @Param('id')
    id: string,

    @Body()
    dto:
      UpdateCaratulaDocumentacionDto,

    @Req()
    req: RequestAutenticado,
  ) {

    const usuario =
      this.getInvestigador(req);


    return this.documentacionService
      .updateCaratula(
        id,
        usuario.userId,
        dto,
      );
  }


  /* ======================================================
     PASO 2
     OBTENER PLAN
  ====================================================== */

  @Get(':id/plan')
  async getPlan(
    @Param('id')
    id: string,

    @Req()
    req: RequestAutenticado,
  ) {

    const usuario =
      this.getInvestigador(req);


    return this.documentacionService
      .getPlanPaso(
        id,
        usuario.userId,
      );
  }


  /* ======================================================
     PASO 2
     GUARDAR PLAN
  ====================================================== */

  @Patch(':id/plan')
  async updatePlan(
    @Param('id')
    id: string,

    @Body()
    dto:
      UpdatePlanInvestigacionDto,

    @Req()
    req: RequestAutenticado,
  ) {

    const usuario =
      this.getInvestigador(req);


    return this.documentacionService
      .updatePlan(
        id,
        usuario.userId,
        dto,
      );
  }


  /* ======================================================
     PASO 3
     OBTENER RÚBRICA
  ====================================================== */

  @Get(':id/rubrica')
  async getRubrica(
    @Param('id')
    id: string,

    @Req()
    req: RequestAutenticado,
  ) {

    const usuario =
      this.getInvestigador(req);


    return this.documentacionService
      .getRubricaPaso(
        id,
        usuario.userId,
      );
  }


  /* ======================================================
     PASO 3
     GUARDAR RÚBRICA
  ====================================================== */

  @Patch(':id/rubrica')
  async updateRubrica(
    @Param('id')
    id: string,

    @Body()
    dto:
      UpdateRubricaDto,

    @Req()
    req: RequestAutenticado,
  ) {

    const usuario =
      this.getInvestigador(req);


    return this.documentacionService
      .updateRubrica(
        id,
        usuario.userId,
        dto,
      );
  }


  /* ======================================================
     ELIMINAR BORRADOR
  ====================================================== */

  @Delete(':id')
  async removeDraft(
    @Param('id')
    id: string,

    @Req()
    req: RequestAutenticado,
  ) {

    const usuario =
      this.getInvestigador(req);


    await this.documentacionService
      .removeDraft(
        id,
        usuario.userId,
      );


    return {
      message:
        'Borrador eliminado correctamente.',
    };
  }


  /* ======================================================
     VALIDAR INVESTIGADOR
  ====================================================== */

  private getInvestigador(
    req: RequestAutenticado,
  ): UsuarioAutenticado {

    const usuario =
      req.user;


    if (
      !usuario ||
      !usuario.userId
    ) {

      throw new ForbiddenException(
        'No se pudo identificar al usuario autenticado.',
      );
    }


    if (
      usuario.role !==
      UserRole.INVESTIGADOR
    ) {

      throw new ForbiddenException(
        'Este módulo es exclusivo para investigadores.',
      );
    }


    return usuario;
  }
}