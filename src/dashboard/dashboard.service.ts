import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  CasosAlerta
} from '../casos-alerta/entities/casos-alerta.entity';

import {
  CasosMaltrato,
  CasosMaltratoDocument
} from '../casos-maltrato/entities/casos-maltrato.entity';

import {
  CasosConflicto,
  CasosConflictoDocument
} from '../casos-conflicto/entities/casos-conflicto.entity';


@Injectable()
export class DashboardService {

  // Recibe los modelos de casos empleados para calcular los indicadores y gráficos del panel.
  constructor(

    @InjectModel(CasosAlerta.name)
    private readonly casosAlertaModel:
      Model<CasosAlerta>,

    @InjectModel(CasosMaltrato.name)
    private readonly casosMaltratoModel:
      Model<CasosMaltratoDocument>,

    @InjectModel(CasosConflicto.name)
    private readonly casosConflictoModel:
      Model<CasosConflictoDocument>,

  ) {}


  // Construye los indicadores y distribuciones del panel según rol y período, limitando los
  // datos personales del investigador a los casos bajo su responsabilidad.
  async obtenerDashboard(
    usuario: {
      userId: string;
      role: string;
    }
  ) {

    const esInvestigador =
      usuario.role === 'Investigador';


    // La misma responsabilidad que en Mis registros: asignado en el flujo
    // actual y creador en registros anteriores que no usan ese proceso.
    const filtro = (proceso: string, estadoRegistro: string): any => {
      if (!esInvestigador) {
        return estadoRegistro === 'Aprobado'
          ? { $or: [{ estadoRegistro }, { estadoRegistro: { $exists: false } }] }
          : { estadoRegistro };
      }
      const investigadorId = new Types.ObjectId(usuario.userId);
      return {
        estadoRegistro,
        $or: [
          { [proceso]: true, investigadorAsignado: investigadorId },
          { [proceso]: { $ne: true }, registradoPor: investigadorId },
        ],
      };
    };

    /*
     * =====================================================
     * CONSULTAS
     * =====================================================
     */

    const [

      alertas,
      maltratos,
      conflictos,

      alertasPendientes,
      maltratosPendientes,
      conflictosPendientes,

      alertasRechazadas,
      maltratosRechazados,
      conflictosRechazados

    ] = await Promise.all([


      /* CASOS OFICIALES */

  this.casosAlertaModel
  .find(filtro('procesoAlerta', 'Aprobado'))
  .populate(
    'registradoPor',
    'nombre role'
  )
  .lean()
  .exec(),

this.casosMaltratoModel
  .find(filtro('procesoMaltrato', 'Aprobado'))
  .populate(
    'registradoPor',
    'nombre role'
  )
  .lean()
  .exec(),

this.casosConflictoModel
  .find(filtro('procesoConflicto', 'Aprobado'))
  .populate(
    'registradoPor',
    'nombre role'
  )
  .lean()
  .exec(),


      /* PENDIENTES */

      this.casosAlertaModel
        .countDocuments(
          filtro('procesoAlerta', 'Pendiente')
        ),

      this.casosMaltratoModel
        .countDocuments(
          filtro('procesoMaltrato', 'Pendiente')
        ),

      this.casosConflictoModel
        .countDocuments(
          filtro('procesoConflicto', 'Pendiente')
        ),


      /* RECHAZADOS */

      this.casosAlertaModel
        .countDocuments(
          filtro('procesoAlerta', 'Rechazado')
        ),

      this.casosMaltratoModel
        .countDocuments(
          filtro('procesoMaltrato', 'Rechazado')
        ),

      this.casosConflictoModel
        .countDocuments(
          filtro('procesoConflicto', 'Rechazado')
        )

    ]);


    /*
     * =====================================================
     * RESPUESTA
     * =====================================================
     */

    return {

      alcance:
        esInvestigador
          ? 'PERSONAL'
          : 'GLOBAL',

      role:
        usuario.role,


      /*
       * Estos son exclusivamente
       * los casos oficiales que alimentarán
       * tus gráficas actuales.
       */

      alertas,

      maltratos,

      conflictos,


      /*
       * Estos NO se mezclan con las gráficas
       * de casos oficiales.
       */

      autorizaciones: {

        pendientes: {

          total:
            alertasPendientes +
            maltratosPendientes +
            conflictosPendientes,

          alertas:
            alertasPendientes,

          maltratos:
            maltratosPendientes,

          conflictos:
            conflictosPendientes

        },


        rechazados: {

          total:
            alertasRechazadas +
            maltratosRechazados +
            conflictosRechazados,

          alertas:
            alertasRechazadas,

          maltratos:
            maltratosRechazados,

          conflictos:
            conflictosRechazados

        }

      },


      /*
       * Resumen rápido.
       * Nos servirá después para las cards
       * del nuevo dashboard V3.
       */

      resumen: {

        totalCasos:
          alertas.length +
          maltratos.length +
          conflictos.length,

        alertas:
          alertas.length,

        maltratos:
          maltratos.length,

        conflictos:
          conflictos.length

      }

    };

  }

}