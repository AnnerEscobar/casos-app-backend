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
  Res,
  UseGuards,
} from '@nestjs/common';

import { Request, Response } from 'express';

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

  // Recibe el servicio que administra borradores, plantillas y PDF de la documentación inicial
  // del expediente.
  constructor(
    private readonly documentacionService:
      DocumentacionInicialService,
  ) {}

  // Comprueba el rol Investigador y solicita el contexto y borrador del expediente para la
  // identidad autenticada.
  @Get('para-caso/:tipo/:casoId')
  paraCaso(@Param('tipo') tipo: string, @Param('casoId') casoId: string, @Req() req: RequestAutenticado) {
    const usuario = this.getInvestigador(req);
    return this.documentacionService.paraCaso(tipo, casoId, usuario.userId);
  }

  // Valida la identidad investigadora y envía el PDF generado con nombre de archivo y cabeceras
  // que evitan almacenar una copia en caché.
  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Req() req: RequestAutenticado, @Res() res: Response) {
    const usuario = this.getInvestigador(req);
    const pdf = await this.documentacionService.generarPdf(id, usuario.userId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="documentacion-${pdf.numeroDeic}.pdf"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdf.buffer);
  }


  /* ======================================================
     CREAR BORRADOR
  ====================================================== */

  // Crea la documentación inicial usando el identificador y nombre de la sesión, sin aceptar una
  // identidad proporcionada por el cliente.
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

  // Devuelve la documentación inicial que pertenece al investigador conectado.
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

  // Valida página y límite y devuelve los borradores pendientes del investigador con el total
  // necesario para paginar.
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

  // Devuelve los documentos enviados o registrados que forman parte del historial del
  // investigador.
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

  // Consulta una documentación por ID utilizando la identidad autenticada para comprobar su
  // propiedad y acceso al caso.
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

  // Envía los cambios validados de la carátula al servicio junto con la identidad del
  // investigador conectado.
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

  // Obtiene la plantilla y los datos guardados del plan para una documentación accesible al
  // investigador.
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

  // Guarda los datos recibidos del plan mediante el servicio, que comprueba propiedad, edición y
  // códigos de plantilla.
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

  // Obtiene la plantilla y respuestas de la rúbrica correspondiente a la documentación del
  // investigador.
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

  // Solicita guardar las respuestas de rúbrica del investigador y delega las validaciones de
  // plantilla y edición.
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

  // Elimina el borrador permitido por el servicio y devuelve la confirmación después de
  // verificar la identidad investigadora.
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

  // Exige un usuario autenticado con identificador y rol Investigador antes de ejecutar las
  // operaciones del módulo.
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
