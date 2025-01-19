import { Injectable } from '@nestjs/common';
import { CreateCasosAlertaDto } from './dto/create-casos-alerta.dto';
import { UpdateCasosAlertaDto } from './dto/update-casos-alerta.dto';
import { google } from 'googleapis';

import * as multer from 'multer';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CasosAlertaService {

  private googleDrive: any;

  constructor(){
    this.googleDrive = google.drive({
      version: 'v3',
      auth:'Mi apikey'
    })
  }


  //metodo par asubir el archivo a google drive
async uploadFileToGoogle(file: Express.Multer.File): Promise<string>{
  const filePath = path.join(__dirname, file.originalname);

  await promisify(fs.writeFile)(filePath, file.buffer);

  try{
    const res = await this.googleDrive.files.create({
      requestBody:{
        name: file.originalname,
        mimeType: file.mimetype,
      },
      media:{
        mimeType: file.mimetype,
        body: fs.createReadStream(filePath),
      },
    });

    await promisify(fs.unlink)(filePath);

    return `https://drive.google.com/uc?id=${res.data.id}`;

  }catch (error){
    console.error('error al subir el archivo a google drive', error);
    throw new error('Error al subir el archivo a drive');
  }

}

async createAlerta(createCasosAlertaDto: CreateCasosAlertaDto, file: Express.Multer.File): Promise<any>{

  const fileUrl = await this.uploadFileToGoogle(file);

  const caso = {
    ...createCasosAlertaDto,
    fileUrls: fileUrl,
  };

  return caso;

}











  //cruds creados por el nestjsd
  create(createCasosAlertaDto: CreateCasosAlertaDto) {
    return 'This action adds a new casosAlerta';
  }

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
