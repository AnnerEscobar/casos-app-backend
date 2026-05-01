import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Informe, InformeDocument } from './entities/informe.entity';
import { CreateInformeDto } from './dto/create-informe.dto';
import { UpdateInformeDto } from './dto/update-informe.dto';
import { GoogleApiService } from 'src/google-api/google-api.service';

@Injectable()
export class InformesService {

  constructor(
    @InjectModel(Informe.name)
    private readonly informeModel: Model<InformeDocument>,
    private readonly googleApiService: GoogleApiService
  ) {}

  async crear(dto: CreateInformeDto): Promise<Informe> {
    const existente = await this.informeModel.findOne({ numeroDeic: dto.numeroDeic });
    if (existente) {
      throw new BadRequestException('Ya existe un informe con este número DEIC.');
    }
    const nuevo = new this.informeModel({ ...dto, estado: 'borrador' });
    return nuevo.save();
  }

  async obtenerTodos(): Promise<Informe[]> {
    return this.informeModel.find().sort({ createdAt: -1 }).exec();
  }

  async obtenerPorDeic(numeroDeic: string): Promise<Informe> {
    const informe = await this.informeModel.findOne({ numeroDeic });
    if (!informe) throw new NotFoundException('Informe no encontrado.');
    return informe;
  }

  async obtenerPendientes(): Promise<Informe[]> {
    return this.informeModel.find({ estado: 'pendiente_registro' }).sort({ createdAt: -1 }).exec();
  }

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

  async marcarPendienteRegistro(numeroDeic: string): Promise<Informe> {
    const informe = await this.informeModel.findOne({ numeroDeic });
    if (!informe) throw new NotFoundException('Informe no encontrado.');
    informe.estado = 'pendiente_registro';
    return informe.save();
  }

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

  async eliminar(numeroDeic: string): Promise<{ message: string }> {
    const resultado = await this.informeModel.deleteOne({ numeroDeic });
    if (resultado.deletedCount === 0) throw new NotFoundException('Informe no encontrado.');
    return { message: 'Informe eliminado correctamente.' };
  }
}