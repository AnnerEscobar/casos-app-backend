import { Injectable } from '@nestjs/common';
import { GoogleDriveService } from 'nestjs-googledrive-upload';

@Injectable()
export class GoogleApiService {

  // Recibe el servicio de Google Drive configurado para realizar las subidas de archivos.
  constructor(private readonly googleDriveService: GoogleDriveService) { }


  // Exige un archivo, lo sube mediante el servicio de Google Drive y devuelve su enlace; informa
  // los fallos de la carga.
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