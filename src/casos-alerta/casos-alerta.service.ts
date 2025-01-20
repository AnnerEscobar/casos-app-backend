import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateCasosAlertaDto } from './dto/create-casos-alerta.dto';
import { UpdateCasosAlertaDto } from './dto/update-casos-alerta.dto';
import { InjectModel } from '@nestjs/mongoose';
import { CasosAlerta } from './entities/casos-alerta.entity';
import { Model } from 'mongoose';
import { GoogleApiService } from 'src/google-api/google-api.service';
import { extname } from 'path';

@Injectable()
export class CasosAlertaService {

 //constructor
  constructor(
    @InjectModel(CasosAlerta.name) private readonly casosAlertaModel: Model<CasosAlerta>,
    private readonly googleApiService: GoogleApiService
  ) { }


  //Metodo para crear un caso
  async create(createCasosAlertaDto: CreateCasosAlertaDto, file: Express.Multer.File): Promise<CasosAlerta> {

    try {
      const existingCaso = await this.casosAlertaModel.findOne({numeroDeic: createCasosAlertaDto.numeroDeic});
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

        fileUrl = await this.googleApiService.uploadFile(renamedFile);
      }

      const newCaso = new this.casosAlertaModel({
        ...createCasosAlertaDto,
        fileUrls: fileUrl
      });

      return newCaso.save()
    } catch (error) {
      throw new BadRequestException(`Error al crear el caso, ${error}`)
    }
  }


  //cruds creados por el nestjsd
  findAll() {
    return `This action returns all casosAlerta`;
  }

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
