import { GoogleApiService } from 'src/google-api/google-api.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCasosConflictoDto } from './dto/create-casos-conflicto.dto';
import { UpdateCasosConflictoDto } from './dto/update-casos-conflicto.dto';
import { InjectModel } from '@nestjs/mongoose';
import { CasosConflicto, CasosConflictoDocument } from './entities/casos-conflicto.entity';
import { Model } from 'mongoose';
import { extname } from 'path';

@Injectable()
export class CasosConflictoService {

  constructor(
    @InjectModel(CasosConflicto.name) 
    private readonly casoModel: Model<CasosConflictoDocument>,
    private googleApiService: GoogleApiService
  ) {}

  async create(createCasosConflictoDto: CreateCasosConflictoDto, file: Express.Multer.File): Promise<CasosConflicto> {
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
      throw new BadRequestException(`Error al crear el caso, ${error}`);
    }
  }

  async findAll(): Promise<CasosConflictoDocument[]> {
    try{
      const conflictos = await this.casoModel.find();
      return conflictos;
    }catch(error){
      throw new BadRequestException(`Error al obtener los maltratos, ${error}`);
    }
    
  }

  
  async agregarSeguimiento(numeroDeic: string, estado: string, file: Express.Multer.File) {
    const caso = await this.casoModel.findOne({ numeroDeic });
  
    if (!caso) {
      throw new NotFoundException('Caso no encontrado');
    }
   // ID de la carpeta de Maltrato en Drive
    let fileUrl: string | null = null;
  
    if (file) {
      const numeroSeguimiento = caso.seguimientos.length + 1;
      const newFileName = `Seguimiento(${numeroSeguimiento})-${numeroDeic}${extname(file.originalname)}`;
      const renamedFile = {
        ...file,
        originalname: newFileName,
      };
      fileUrl = await this.googleApiService.uploadFile(renamedFile);
    }
  
    const seguimiento = {
      fecha: new Date(),
      estado,
      archivos: fileUrl ? [fileUrl] : [],
    };
  
    caso.seguimientos.push(seguimiento);
    caso.estadoInvestigacion = estado;
    console.log('Subiendo archivo a carpeta de pruebas...');
    await caso.save();
    console.log('Archivo subido con éxito:');
    return { mensaje: 'Seguimiento agregado correctamente', seguimiento };
  }
  
  
  async buscarPorNumeroDeic(numeroDeic: string): Promise<CasosConflictoDocument> {
    const caso = await this.casoModel.findOne({ numeroDeic });
  
    if (!caso) {
      throw new NotFoundException(`No se encontró ningún caso con número DEIC: ${numeroDeic}`);
    }
  
    return caso;
  }
  


  //metodos sin implementar

  findOne(id: number) {
    return `This action returns a #${id} casosConflicto`;
  }

  update(id: number, updateCasosConflictoDto: UpdateCasosConflictoDto) {
    return `This action updates a #${id} casosConflicto`;
  }

  remove(id: number) {
    return `This action removes a #${id} casosConflicto`;
  }
}
