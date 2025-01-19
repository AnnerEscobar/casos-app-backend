import { Injectable } from '@nestjs/common';
import { GoogleDriveService } from 'nestjs-googledrive-upload';

@Injectable()
export class GoogleApiService {

  constructor(private readonly googleDriveService: GoogleDriveService) { }


  public async uploadFile(file: Express.Multer.File): Promise<string> {
    try {
      if (!file) {
        throw new Error('No se recibio ningun archivo')
      }
      const fileName = file.originalname;
      const mimeType = file.mimetype;

      const link = await this.googleDriveService.uploadImage(file);
      return link;
    } catch (error) {
      throw new Error(`Error al subir archivo a Google Drive: ${error.message}`);
    }
  }
}