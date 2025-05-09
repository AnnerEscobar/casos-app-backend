import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCasosAlertaDto } from './dto/create-casos-alerta.dto';
import { UpdateCasosAlertaDto } from './dto/update-casos-alerta.dto';
import { InjectModel } from '@nestjs/mongoose';
import { CasosAlerta, CasosAlertaDocument, } from './entities/casos-alerta.entity';
import { Model } from 'mongoose';
import { GoogleApiService } from 'src/google-api/google-api.service';
import { extname } from 'path';

@Injectable()
export class CasosAlertaService {

  constructor(
    @InjectModel(CasosAlerta.name)
    private readonly casosAlertaModel: Model<CasosAlertaDocument>,
    private readonly googleApiService: GoogleApiService
  ) { }


  //Metodo para crear un caso
  async create(createCasosAlertaDto: CreateCasosAlertaDto, file: Express.Multer.File): Promise<CasosAlerta> {

    try {
      const existingCaso = await this.casosAlertaModel.findOne({ numeroDeic: createCasosAlertaDto.numeroDeic });
      if (existingCaso) {
        throw new BadRequestException('El caso con este número DEIC ya está registrado. No se guardará el archivo.');
      }

      let fileUrl = null;
      if (file) {
        const newFileName = `${createCasosAlertaDto.numeroDeic}${extname(file.originalname)}`;

        const renamedFile = {
          ...file,
          originalname: newFileName,
        }

        const fileId = await this.googleApiService.uploadFile(renamedFile);
        // Extraer el ID del archivo de la URL de la vista previa
        const fileIdRegex = /id=([^&]+)/;
        const match = fileId.match(fileIdRegex);
        const extractedFileId = match ? match[1] : null;

        if (!extractedFileId) {
          throw new BadRequestException('No se pudo extraer el ID del archivo de Google Drive.');
        }

        // Generar el enlace de descarga directa
        fileUrl = `https://drive.google.com/uc?export=download&id=${extractedFileId}`;
      }

      const newCaso = new this.casosAlertaModel({
        ...createCasosAlertaDto,
        fileUrls: fileUrl
      });

      return newCaso.save()
    } catch (error) {
      console.error('Error interno al crear el caso:', error);
      throw new BadRequestException(`Error al crear el caso, ${error}`)
    }
  }

  //cruds creados por el nestjsd
  async findAll(): Promise<CasosAlerta[]> {
    try {
      const alertas = await this.casosAlertaModel.find().exec();
      return alertas;
    } catch (error) {
      throw new Error(`Error al obtener los casos de alerta, ${error.message}`)
    }
  }

  // Método para buscar alertas por número de expediente MP
  async buscarPorNumeroMp(numeroMp: string): Promise<CasosAlerta[]> {
    try {
      const alertas = await this.casosAlertaModel.find({ numeroMp }).exec();
      if (alertas.length === 0) {
        throw new NotFoundException('No se encontraron alertas con el número de expediente MP proporcionado.');
      }
      return alertas;
    } catch (error) {
      throw new BadRequestException(`Error al buscar alertas por número MP: ${error.message}`);
    }
  }

  //metodo para agregar un seguimiento a un caso

  async actualizarCasoConSeguimiento(
    numeroDeic: string,
    dto: UpdateCasosAlertaDto,
    files: Express.Multer.File[],
  ) {
    const caso = await this.casosAlertaModel.findOne({ numeroDeic });

    if (!caso) {
      throw new NotFoundException('Caso de alerta no encontrado');
    }

    // Subir archivos de seguimiento
    const fileUrls = await Promise.all(
      files.map((file, index) => {
        const nombre = `Seguimiento(${index + 1})-${numeroDeic}${extname(file.originalname)}`;
        const renamed = { ...file, originalname: nombre };
        return this.googleApiService.uploadFile(renamed);
      })
    );


    // Construir objeto seguimiento
    const seguimiento = {
      nuevoEstado: dto.nuevoEstado,
      fecha: new Date(),
      nombreAcompanante: dto.nombreAcompanante,
      telefono: dto.telefono,
      direccionLocalizacion: dto.direccionLocalizacion,
      horaLocalizacion: dto.horaLocalizacion,
      fechaLocalizacion: dto.fechaLocalizacion,
      archivos: fileUrls,
    };

    caso.estadoInvestigacion = dto.nuevoEstado;

    caso.seguimientos = caso.seguimientos || [];
    caso.seguimientos.push(seguimiento);

    console.log('Seguimientos antes de guardar:', caso.seguimientos);
    console.log('Agregando seguimiento:', seguimiento);
    console.log('Total seguimientos ahora:', caso.seguimientos.length);


    caso.markModified('seguimientos');
    await caso.save();
    return { message: 'Seguimiento agregado correctamente', seguimiento };
  }

  async buscarPorNumeroDeic(numeroDeic: string): Promise<CasosAlerta> {
    const caso = await this.casosAlertaModel.findOne({ numeroDeic });

    if (!caso) {
      console.warn('No se encontró el caso');
      throw new NotFoundException('No se encontró un caso con ese número DEIC.');
    }
    return caso;
  }


  //metodos no usados
  findOne(id: number) {
    return `This action returns a #${id} casosAlerta`;
  }

  update(id: number, updateCasosAlertaDto: UpdateCasosAlertaDto) {
    return `This action updates a #${id} casosAlerta`;
  }

  remove(id: number) {
    return `This action removes a #${id} casosAlerta`;
  }
}
