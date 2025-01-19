import { Controller, Get, Post, Body, Patch, Param, Delete, UploadedFile, UseInterceptors } from '@nestjs/common';
import { GoogleApiService } from './google-api.service';
import { FileInterceptor } from '@nestjs/platform-express/multer';

@Controller('google-drive')
export class GoogleApiController {

  constructor(private readonly googleApiService: GoogleApiService) { }


  // Endpoint para subir cualquier archivo
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    try {
      const link = await this.googleApiService.uploadFile(file);
      return { message: 'Archivo subido con éxito', publicUrl: link };
    } catch (error) {
      return { message: 'Error al subir archivo', error: error.message };
    }
  }

}

