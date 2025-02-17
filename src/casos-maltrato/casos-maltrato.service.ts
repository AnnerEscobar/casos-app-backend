import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateCasosMaltratoDto } from './dto/create-casos-maltrato.dto';
import { UpdateCasosMaltratoDto } from './dto/update-casos-maltrato.dto';
import { CasosMaltrato, CasosMaltratoDocument } from './entities/casos-maltrato.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GoogleApiService } from 'src/google-api/google-api.service';
import { extname } from 'path';

@Injectable()
export class CasosMaltratoService {

  constructor(
    @InjectModel(CasosMaltrato.name) private readonly casoModel: Model<CasosMaltratoDocument>,
    private googleApiService: GoogleApiService
  ) { }

  async create(createCasosConflictoDto: CreateCasosMaltratoDto, file: Express.Multer.File): Promise<CasosMaltrato> {
    try {
      // 📌 1️⃣ Verificar si el caso ya existe
      const existingCaso = await this.casoModel.findOne({ numeroDeic: createCasosConflictoDto.numeroDeic });
      if (existingCaso) {
        throw new BadRequestException('El caso con este número DEIC ya está registrado. No se guardará el archivo.');
      }

      let fileUrl = null;

      // 📌 2️⃣ Subir el archivo si existe
      if (file) {
        const newFileName = `${createCasosConflictoDto.numeroDeic}${extname(file.originalname)}`;

        const renamedFile = {
          ...file,
          originalname: newFileName,
        };

        fileUrl = await this.googleApiService.uploadFile(renamedFile);
      }

      // 📌 3️⃣ Crear el nuevo caso con la URL del archivo
      const newCaso = new this.casoModel({
        ...createCasosConflictoDto,
        fileUrls: fileUrl ? [fileUrl] : [],
      });

      return newCaso.save();
    } catch (error) {
      console.log(error);
      throw new BadRequestException(`Error al crear el caso, ${error}`);
      
    }
  }



  findAll() {
    return `This action returns all casosMaltrato`;
  }

  findOne(id: number) {
    return `This action returns a #${id} casosMaltrato`;
  }

  update(id: number, updateCasosMaltratoDto: UpdateCasosMaltratoDto) {
    return `This action updates a #${id} casosMaltrato`;
  }

  remove(id: number) {
    return `This action removes a #${id} casosMaltrato`;
  }
}
