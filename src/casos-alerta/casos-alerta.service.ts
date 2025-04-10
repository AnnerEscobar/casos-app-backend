import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCasosAlertaDto } from './dto/create-casos-alerta.dto';
import { UpdateCasosAlertaDto } from './dto/update-casos-alerta.dto';
import { InjectModel } from '@nestjs/mongoose';
import { CasosAlerta } from './entities/casos-alerta.entity';
import { Model } from 'mongoose';
import { GoogleApiService } from 'src/google-api/google-api.service';
import { extname } from 'path';

@Injectable()
export class CasosAlertaService {

  constructor(
    @InjectModel(CasosAlerta.name)
    private readonly casosAlertaModel: Model<CasosAlerta>,
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
