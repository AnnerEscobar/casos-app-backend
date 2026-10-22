import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Informe, InformeDocument } from './entities/informe.entity';
import { CreateInformeDto } from './dto/create-informe.dto';
import { UpdateInformeDto } from './dto/update-informe.dto';
import { GoogleApiService } from 'src/google-api/google-api.service';

@Injectable()
export class InformesService {

  // Recibe el modelo de informes y el servicio de Google Drive utilizado para sus PDF y
  // ampliaciones.
  constructor(
    @InjectModel(Informe.name)
    private readonly informeModel: Model<InformeDocument>,
    private readonly googleApiService: GoogleApiService
  ) {}

  // Comprueba la correspondencia entre tipo y DEIC, impide duplicados y guarda el informe como
  // borrador.
  async crear(dto: CreateInformeDto): Promise<Informe> {
    this.validarFormatoDisponible(dto);

    const numeroDeic = dto.numeroDeic.trim().toUpperCase();
    const existente = await this.informeModel.findOne({ numeroDeic });
    if (existente) {
      throw new BadRequestException('Ya existe un informe con este número DEIC.');
    }
    const nuevo = new this.informeModel({ ...dto, numeroDeic, estado: 'borrador' });
    return nuevo.save();
  }

  // Comprueba que el prefijo DEIC coincida con el tipo de informe antes de usar su formato
  // institucional.
  private validarFormatoDisponible(dto: CreateInformeDto): void {
    const tipoInforme = dto.tipoInforme?.toLowerCase();
    const numeroDeic = dto.numeroDeic?.trim().toUpperCase();
    const formatoValido =
      (tipoInforme === 'alerta' && numeroDeic?.startsWith('DEIC52-')) ||
      (tipoInforme === 'maltrato' && numeroDeic?.startsWith('DEIC51-')) ||
      (tipoInforme === 'conflicto' && numeroDeic?.startsWith('DEIC53-'));

    if (!formatoValido) {
      throw new BadRequestException(
        'El tipo de informe no coincide con el numero DEIC. Usa DEIC52 para alerta, DEIC51 para maltrato o DEIC53 para conflicto.'
      );
    }
  }

  // Consulta los informes ordenados del más reciente al más antiguo.
  async obtenerTodos(): Promise<Informe[]> {
    return this.informeModel.find().sort({ createdAt: -1 }).exec();
  }

  // Busca el informe por DEIC y rechaza la consulta si no existe.
  async obtenerPorDeic(numeroDeic: string): Promise<Informe> {
    const informe = await this.informeModel.findOne({ numeroDeic });
    if (!informe) throw new NotFoundException('Informe no encontrado.');
    return informe;
  }

  // Consulta los informes en estado pendiente de registro ordenados por fecha de creación.
  async obtenerPendientes(): Promise<Informe[]> {
    return this.informeModel.find({ estado: 'pendiente_registro' }).sort({ createdAt: -1 }).exec();
  }

  // Actualiza los campos recibidos de las secciones del informe y conserva los ya guardados
  // cuando no se proporcionan reemplazos.
  async actualizarSeccion(numeroDeic: string, dto: UpdateInformeDto): Promise<Informe> {
    const informe = await this.informeModel.findOne({ numeroDeic });
    if (!informe) throw new NotFoundException('Informe no encontrado.');

    const seccionesObj = ['datosGenerales', 'perfilVictima', 'perfilSecundario', 'entrevistas', 'perfilacionLugar', 'diligencias', 'conclusiones'];

    Object.keys(dto).forEach(key => {
      if (key === 'seccionesCompletadas') return;
      if (dto[key] !== undefined) {
        informe[key] = dto[key];
        if (seccionesObj.includes(key)) informe.markModified(key);
      }
    });

    if (dto.seccionesCompletadas) {
      const nuevas = dto.seccionesCompletadas.filter(s => !informe.seccionesCompletadas.includes(s));
      informe.seccionesCompletadas.push(...nuevas);
      informe.markModified('seccionesCompletadas');
    }

    return informe.save();
  }

  // Busca el informe y actualiza su estado a pendiente de registro.
  async marcarPendienteRegistro(numeroDeic: string): Promise<Informe> {
    const informe = await this.informeModel.findOne({ numeroDeic });
    if (!informe) throw new NotFoundException('Informe no encontrado.');
    informe.estado = 'pendiente_registro';
    return informe.save();
  }

  // Busca el informe, sube el PDF cuando se adjunta y guarda su enlace junto con el estado de
  // registro correspondiente.
  async registrarConPdf(
    numeroDeic: string,
    pdfFile: Express.Multer.File,
    dto: UpdateInformeDto
  ): Promise<Informe> {
    const informe = await this.informeModel.findOne({ numeroDeic });
    if (!informe) throw new NotFoundException('Informe no encontrado.');

    if (pdfFile) {
      const renamed = { ...pdfFile, originalname: `INFORME-FINAL-${numeroDeic}.pdf` };
      const fileUrl = await this.googleApiService.uploadFile(renamed);
      const match = fileUrl.match(/id=([^&]+)/);
      const id = match ? match[1] : null;
      informe.pdfFinalUrl = id ? `https://drive.google.com/uc?export=download&id=${id}` : fileUrl;
    }

    if (dto) {
      Object.keys(dto).forEach(key => {
        if (dto[key] !== undefined) informe[key] = dto[key];
      });
    }

    informe.estado = 'registrado';
    return informe.save();
  }

  // Añade al informe una ampliación con sus datos y el enlace del archivo opcional subido a
  // Drive.
  async agregarAmpliacion(
    numeroDeic: string,
    descripcion: string,
    file?: Express.Multer.File
  ): Promise<Informe> {
    const informe = await this.informeModel.findOne({ numeroDeic });
    if (!informe) throw new NotFoundException('Informe no encontrado.');

    let fileUrl: string | undefined;
    if (file) {
      const renamed = { ...file, originalname: `AMPLIACION-${numeroDeic}-${Date.now()}.pdf` };
      const url = await this.googleApiService.uploadFile(renamed);
      const match = url.match(/id=([^&]+)/);
      const id = match ? match[1] : null;
      fileUrl = id ? `https://drive.google.com/uc?export=download&id=${id}` : url;
    }

    informe.ampliaciones = informe.ampliaciones || [];
    informe.ampliaciones.push({ fecha: new Date(), descripcion, fileUrl });
    informe.markModified('ampliaciones');
    return informe.save();
  }

  // Borra el informe por DEIC e informa si no existía un registro para eliminar.
  async eliminar(numeroDeic: string): Promise<{ message: string }> {
    const resultado = await this.informeModel.deleteOne({ numeroDeic });
    if (resultado.deletedCount === 0) throw new NotFoundException('Informe no encontrado.');
    return { message: 'Informe eliminado correctamente.' };
  }
}
