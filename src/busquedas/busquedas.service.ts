import { Injectable } from '@nestjs/common';
import { CreateBusquedaDto } from './dto/create-busqueda.dto';
import { UpdateBusquedaDto } from './dto/update-busqueda.dto';
import { CasosAlerta } from 'src/casos-alerta/entities/casos-alerta.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CasosMaltrato, CasosMaltratoDocument } from 'src/casos-maltrato/entities/casos-maltrato.entity';
import { CasosConflicto, CasosConflictoDocument } from 'src/casos-conflicto/entities/casos-conflicto.entity';
import { PipelineStage } from 'mongoose';


@Injectable()
export class BusquedasService {

  constructor(
    @InjectModel(CasosAlerta.name)
    private readonly casosAlertaModel: Model<CasosAlerta>,
    @InjectModel(CasosMaltrato.name)
    private readonly casosMaltratoModel: Model<CasosMaltratoDocument>,
    @InjectModel(CasosConflicto.name)
    private readonly casosConflictoModel: Model<CasosConflictoDocument>,
  ) { }


  // Método para buscar por número de expediente MP en los tres tipos de casos
  async buscarPorExpedienteMP(numeroMp: string): Promise<any[]> {
    try {
      // Buscar en las tres colecciones en paralelo
      const [alertas, maltratos, conflictos] = await Promise.all([
        this.casosAlertaModel.find({ numeroMp }).exec(),
        this.casosMaltratoModel.find({ numeroMp }).exec(),
        this.casosConflictoModel.find({ numeroMp }).exec(),
      ]);

      // Combinar los resultados y agregar un campo "tipo" para identificar el tipo de caso
      const resultados = [
        ...alertas.map((alerta) => ({ ...alerta.toObject(), tipo: 'Alerta' })),
        ...maltratos.map((maltrato) => ({ ...maltrato.toObject(), tipo: 'Maltrato' })),
        ...conflictos.map((conflicto) => ({ ...conflicto.toObject(), tipo: 'Conflicto' })),
      ];

      return resultados;
    } catch (error) {
      throw new Error(`Error al buscar por expediente MP: ${error.message}`);
    }
  }

  async buscarPorNumeroDeic(numeroDeic: string): Promise<any[]> {
    try {
      // Buscar en las tres colecciones en paralelo
      const [alertas, maltratos, conflictos] = await Promise.all([
        this.casosAlertaModel.find({ numeroDeic }).exec(),
        this.casosMaltratoModel.find({ numeroDeic }).exec(),
        this.casosConflictoModel.find({ numeroDeic }).exec(),
      ]);

      // Combinar los resultados y agregar un campo "tipo" para identificar el tipo de caso
      const resultados = [
        ...alertas.map((alerta) => ({ ...alerta.toObject(), tipo: 'Alerta' })),
        ...maltratos.map((maltrato) => ({ ...maltrato.toObject(), tipo: 'Maltrato' })),
        ...conflictos.map((conflicto) => ({ ...conflicto.toObject(), tipo: 'Conflicto' })),
      ];

      return resultados;
    } catch (error) {
      throw new Error(`Error al buscar por número DEIC: ${error.message}`);
    }
  }

  async buscarPorAlertaAlbaKeneth(numeroAlerta: string): Promise<any[]> {
    try {
      // Buscar solo en la colección de casos de alerta
      const alertas = await this.casosAlertaModel.find({ numeroAlerta }).exec();

      // Agregar un campo "tipo" para identificar que son casos de alerta
      const resultados = alertas.map((alerta) => ({
        ...alerta.toObject(),
        tipo: 'Alerta',
      }));

      return resultados;
    } catch (error) {
      throw new Error(`Error al buscar por número de alerta: ${error.message}`);
    }
  }

  async buscarPorNombre(nombre: string): Promise<any[]> {
    try {
      // Buscar en casos de alerta
      const alertas = await this.casosAlertaModel.find({
        $or: [
          { nombreDesaparecido: { $regex: nombre, $options: 'i' } },
        ],
      }).exec();

      // Buscar en casos de maltrato (en infractores y víctimas)
      const maltratos = await this.casosMaltratoModel.find({
        $or: [
          { 'infractores.nombre': { $regex: nombre, $options: 'i' } },
          { 'victimas.nombre': { $regex: nombre, $options: 'i' } },
        ],
      }).exec();

      // Buscar en casos de conflicto (en infractores y víctimas)
      const conflictos = await this.casosConflictoModel.find({
        $or: [
          { 'infractores.nombre': { $regex: nombre, $options: 'i' } },
          { 'victimas.nombre': { $regex: nombre, $options: 'i' } },
        ],
      }).exec();

      // Combinar resultados y agregar un campo "tipo" para identificar el tipo de caso
      const resultados = [
        ...alertas.map((alerta) => ({ ...alerta.toObject(), tipo: 'Alerta' })),
        ...maltratos.map((maltrato) => ({ ...maltrato.toObject(), tipo: 'Maltrato' })),
        ...conflictos.map((conflicto) => ({ ...conflicto.toObject(), tipo: 'Conflicto' })),
      ];

      return resultados;
    } catch (error) {
      throw new Error(`Error al buscar por nombre: ${error.message}`);
    }

  }


async buscarCasosFiltrados(filtros: any): Promise<any[]> {
  const { tipoCaso, estado, fechaInicio, fechaFin } = filtros;

  // ✅ Corrección: usar createdAt, no fechaRegistro
  const fechaFiltro = (fechaInicio && fechaFin) ? {
    createdAt: {
      $gte: new Date(fechaInicio),
      $lte: new Date(fechaFin),
    }
  } : {};

  let resultados: any[] = [];

  if (tipoCaso === 'Alerta Alba-Keneth') {
    const query: any = { ...fechaFiltro };
    if (estado) query.estadoInvestigacion = estado;

    const alertas = await this.casosAlertaModel.find(query).exec();
    resultados = alertas.map(alerta => ({ ...alerta.toObject(), tipo: 'Alerta' }));
  }

  else if (tipoCaso === 'Maltrato') {
    const query: any = { ...fechaFiltro };
    if (estado) query.estadoInvestigacion = estado;

    const maltratos = await this.casosMaltratoModel.find(query).exec();
    resultados = maltratos.map(m => ({ ...m.toObject(), tipo: 'Maltrato' }));
  }

  else if (tipoCaso === 'Conflicto') {
    const conflictos = await this.casosConflictoModel.find({ ...fechaFiltro }).exec();
    resultados = conflictos.map(c => ({ ...c.toObject(), tipo: 'Conflicto' }));
  }

  return resultados;
}



async obtenerEstadisticasMensuales(): Promise<any[]> {
  const pipeline: PipelineStage[] = [
    {
      $group: {
        _id: {
          mes: { $month: "$createdAt" },
          anio: { $year: "$createdAt" }
        },
        total: { $sum: 1 }
      }
    },
    {
      $sort: {
        "_id.anio": 1 as 1 | -1,
        "_id.mes": 1 as 1 | -1
      }
    }
  ];

  const [alertas, maltratos, conflictos] = await Promise.all([
    this.casosAlertaModel.aggregate(pipeline).exec(),
    this.casosMaltratoModel.aggregate(pipeline).exec(),
    this.casosConflictoModel.aggregate(pipeline).exec()
  ]);

  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const normalizar = (resultados: any[], tipo: string) => {
    return resultados.map(r => ({
      mes: meses[r._id.mes - 1],
      anio: r._id.anio,
      tipo,
      total: r.total
    }));
  };

  return [
    ...normalizar(alertas, 'Alerta'),
    ...normalizar(maltratos, 'Maltrato'),
    ...normalizar(conflictos, 'Conflicto')
  ];
}














  create(createBusquedaDto: CreateBusquedaDto) {
    return 'This action adds a new busqueda';
  }

  findAll() {
    return `This action returns all busquedas`;
  }





  remove(id: number) {
    return `This action removes a #${id} busqueda`;
  }
}
