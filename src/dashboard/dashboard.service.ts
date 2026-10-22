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
  // datos personales del investigador a sus casos registrados.
  async obtenerDashboard(
    usuario: {
      userId: string;
      role: string;
    }
  ) {

    const esInvestigador =
      usuario.role === 'Investigador';


    /*
     * =====================================================
     * FILTRO DE CASOS OFICIALES
     * =====================================================
     *
     * INVESTIGADOR:
     * Solo casos registrados por él y aprobados.
     *
     * ANALISTA / JEFE / ADMINISTRADOR:
     * Todos los casos aprobados +
     * históricos que todavía no poseen estadoRegistro.
     */

    const filtroOficiales: any =
      esInvestigador
        ? {
            registradoPor:
              new Types.ObjectId(
                usuario.userId
              ),

            estadoRegistro:
              'Aprobado'
          }
        : {
            $or: [
              {
                estadoRegistro:
                  'Aprobado'
              },
              {
                estadoRegistro: {
                  $exists: false
                }
              }
            ]
          };


    /*
     * =====================================================
     * PENDIENTES
     * =====================================================
     */

    const filtroPendientes: any =
      esInvestigador
        ? {
            registradoPor:
              new Types.ObjectId(
                usuario.userId
              ),

            estadoRegistro:
              'Pendiente'
          }
        : {
            estadoRegistro:
              'Pendiente'
          };


    /*
     * =====================================================
     * RECHAZADOS
     * =====================================================
     */

    const filtroRechazados: any =
      esInvestigador
        ? {
            registradoPor:
              new Types.ObjectId(
                usuario.userId
              ),

            estadoRegistro:
              'Rechazado'
          }
        : {
            estadoRegistro:
              'Rechazado'
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
  .find(filtroOficiales)
  .populate(
    'registradoPor',
    'nombre role'
  )
  .lean()
  .exec(),

this.casosMaltratoModel
  .find(filtroOficiales)
  .populate(
    'registradoPor',
    'nombre role'
  )
  .lean()
  .exec(),

this.casosConflictoModel
  .find(filtroOficiales)
  .populate(
    'registradoPor',
    'nombre role'
  )
  .lean()
  .exec(),


      /* PENDIENTES */

      this.casosAlertaModel
        .countDocuments(
          filtroPendientes
        ),

      this.casosMaltratoModel
        .countDocuments(
          filtroPendientes
        ),

      this.casosConflictoModel
        .countDocuments(
          filtroPendientes
        ),


      /* RECHAZADOS */

      this.casosAlertaModel
        .countDocuments(
          filtroRechazados
        ),

      this.casosMaltratoModel
        .countDocuments(
          filtroRechazados
        ),

      this.casosConflictoModel
        .countDocuments(
          filtroRechazados
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