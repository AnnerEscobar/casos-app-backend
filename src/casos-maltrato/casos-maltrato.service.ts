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
    @InjectModel(CasosMaltrato.name) 
    private readonly casoModel: Model<CasosMaltratoDocument>,
    private googleApiService: GoogleApiService
  ) { }


  async create(CreateCasosMaltratoDto: CreateCasosMaltratoDto, file: Express.Multer.File): Promise<CasosMaltrato> {
    try {
      // 📌 1️⃣ Verificar si el caso ya existe
      const existingCaso = await this.casoModel.findOne({ numeroDeic: CreateCasosMaltratoDto.numeroDeic });
      if (existingCaso) {
        throw new BadRequestException('El caso con este número DEIC ya está registrado. No se guardará el archivo.');
      }

      let fileUrl = null;
    
      if (file) {
        const newFileName = `${CreateCasosMaltratoDto.numeroDeic}${extname(file.originalname)}`;

        const renamedFile = {
          ...file,
          originalname: newFileName,
        };

        fileUrl = await this.googleApiService.uploadFile(renamedFile);
      }

      const newCaso = new this.casoModel({
        ...CreateCasosMaltratoDto,
        fileUrls: fileUrl ? [fileUrl] : [],
      });

      return newCaso.save();
    } catch (error) {
      console.log(error);
      throw new BadRequestException(`Error al crear el caso, ${error}`);
      
    }
  }

  async findAll():Promise<CasosMaltratoDocument[]> {
    try{
      const maltratos = await this.casoModel.find().exec();
      return maltratos;
    }catch(error){
      throw new Error(`Error al obtener los casos de conflicto, ${error.message}`)
    }

  }


  //no implementados
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
