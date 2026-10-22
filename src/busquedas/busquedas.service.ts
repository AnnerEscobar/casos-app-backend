import { BadRequestException, Injectable } from '@nestjs/common';
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

  // Recibe los modelos de Alerta, Maltrato y Conflicto utilizados para unificar consultas y
  // estadísticas.
  constructor(
    @InjectModel(CasosAlerta.name)
    private readonly casosAlertaModel: Model<CasosAlerta>,
    @InjectModel(CasosMaltrato.name)
    private readonly casosMaltratoModel: Model<CasosMaltratoDocument>,
    @InjectModel(CasosConflicto.name)
    private readonly casosConflictoModel: Model<CasosConflictoDocument>,
  ) { }


  // Método para buscar por número de expediente MP en los tres tipos de casos
  // Consulta el número MP en las tres colecciones y combina los resultados identificando su tipo
  // de caso.
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

  // Busca el DEIC en los tres tipos de expediente y unifica las coincidencias con su tipo
  // correspondiente.
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

  // Consulta las alertas por su número Alba-Keneth y marca el tipo en los resultados.
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

  // Busca coincidencias de nombres en desaparecidos, víctimas e infractores y reúne los
  // resultados de las tres colecciones.
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

  // Busca el CUI o DPI en las personas de Maltrato y Conflicto y devuelve las coincidencias con
  // su tipo de expediente.
  async buscarPorCUI(cui: string): Promise<any[]> {
    try {
      const term = cui.trim();
      const [maltratos, conflictos] = await Promise.all([
        this.casosMaltratoModel.find({
          $or: [
            { 'infractores.cui': { $regex: term, $options: 'i' } },
            { 'victimas.cui': { $regex: term, $options: 'i' } },
          ],
        }).exec(),
        this.casosConflictoModel.find({
          $or: [
            { 'infractores.cui': { $regex: term, $options: 'i' } },
            { 'victimas.cui': { $regex: term, $options: 'i' } },
          ],
        }).exec(),
      ]);

      return [
        ...maltratos.map((maltrato) => ({ ...maltrato.toObject(), tipo: 'Maltrato' })),
        ...conflictos.map((conflicto) => ({ ...conflicto.toObject(), tipo: 'Conflicto' })),
      ];
    } catch (error) {
      throw new Error(`Error al buscar por CUI/DPI: ${error.message}`);
    }
  }


// Valida el rango de fechas y consulta los tipos de caso seleccionados aplicando estado,
// fechas y filtros específicos de Alerta.
async buscarCasosFiltrados(filtros: any): Promise<any[]> {
  const { tipoCaso, estado, fechaInicio, fechaFin, origenAlerta, casaHogar } = filtros;

  const rango: any = {};
  if (fechaInicio) rango.$gte = new Date(fechaInicio);
  if (fechaFin) { rango.$lte = new Date(fechaFin); if (/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) rango.$lte.setUTCHours(23,59,59,999); }
  if (Object.values(rango).some((d: Date) => Number.isNaN(d.getTime())) || (rango.$gte && rango.$lte && rango.$gte > rango.$lte)) throw new BadRequestException('Rango de fechas inválido.');
  if (tipoCaso && !['Alerta Alba-Keneth','Maltrato','Conflicto'].includes(tipoCaso)) throw new BadRequestException('Tipo de caso inválido.');
  const fechaFiltro = Object.keys(rango).length ? { createdAt: rango } : {};

  let resultados: any[] = [];

  if (!tipoCaso || tipoCaso === 'Alerta Alba-Keneth') {
    const query: any = { ...fechaFiltro };
    if (estado) query.estadoInvestigacion = estado;
    if (origenAlerta) query.origenAlerta = origenAlerta;
    if (casaHogar) query.casaHogar = { $regex: casaHogar, $options: 'i' };

    const alertas = await this.casosAlertaModel.find(query).exec();
    resultados.push(...alertas.map(alerta => ({ ...alerta.toObject(), tipo: 'Alerta' })));
  }

  if (!tipoCaso || tipoCaso === 'Maltrato') {
    const query: any = { ...fechaFiltro };
    if (estado) query.estadoInvestigacion = estado;

    const maltratos = await this.casosMaltratoModel.find(query).exec();
    resultados.push(...maltratos.map(m => ({ ...m.toObject(), tipo: 'Maltrato' })));
  }

  if (!tipoCaso || tipoCaso === 'Conflicto') {
    const conflictos = await this.casosConflictoModel.find({ ...fechaFiltro, ...(estado ? { estadoInvestigacion: estado } : {}) }).exec();
    resultados.push(...conflictos.map(c => ({ ...c.toObject(), tipo: 'Conflicto' })));
  }

  return resultados;
}



// Agrupa los registros de cada colección por mes y año y combina sus totales para el gráfico
// mensual.
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

  // Adapta los resultados agregados de cada tipo de caso al formato utilizado para consolidar
  // las estadísticas mensuales.
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














  // Devuelve un mensaje provisional de creación de búsqueda; todavía no guarda información.
  create(createBusquedaDto: CreateBusquedaDto) {
    return 'This action adds a new busqueda';
  }

  // Devuelve un mensaje provisional de listado; todavía no consulta una colección de búsquedas.
  findAll() {
    return `This action returns all busquedas`;
  }





  // Devuelve un mensaje provisional para el identificador recibido; todavía no elimina
  // información.
  remove(id: number) {
    return `This action removes a #${id} busqueda`;
  }
}
