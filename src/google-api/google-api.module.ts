import { Module } from '@nestjs/common';
import { GoogleApiService } from './google-api.service';
import { GoogleApiController } from './google-api.controller';
import { GoogleDriveConfig, GoogleDriveModule } from 'nestjs-googledrive-upload';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

let googleConfig: GoogleDriveConfig;

const googleCredentialsRaw = process.env.GOOGLE_CREDENTIALS_JSON;

if (googleCredentialsRaw) {
  console.log('✔ Usando credenciales desde variable de entorno');
  googleConfig = JSON.parse(googleCredentialsRaw);
} else {
  const localPath = path.join(__dirname, '..', '..', 'config', 'google-credentials.json');
  if (fs.existsSync(localPath)) {
    console.log('✔ Usando credenciales desde archivo local');
    const raw = fs.readFileSync(localPath, 'utf8');
    googleConfig = JSON.parse(raw);
  } else {
    throw new Error('❌ No se encontraron credenciales de Google Drive ni por variable de entorno ni por archivo local.');
  }
}

@Module({
  controllers: [GoogleApiController],
  providers: [GoogleApiService],
  imports: [
    GoogleDriveModule.register(googleConfig, /* '1YXw6jxvyeUy7xIAvrLEMvP3kkiSiibph' */
      '16uyaU1wkYlYrpBnAZpszhqCf1ndv3kHF' /* prueba/produccion */),
    MulterModule.register({
      storage: memoryStorage(),
    }),
  ],
  exports: [GoogleApiService],
})
export class GoogleApiModule {}



/* import { Module } from '@nestjs/common';
import { GoogleApiService } from './google-api.service';
import { GoogleApiController } from './google-api.controller';
import { GoogleDriveConfig, GoogleDriveModule } from 'nestjs-googledrive-upload';
import * as googleConfig from '../../config/google-credentials.json';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { google } from 'googleapis';
import path from 'path';
import * as fs from 'fs';

let googleconfig: GoogleDriveConfig;

const googlecredentialsRaw = process.env.GOOGLE_CREDENTIALS_JSON;
if(googlecredentialsRaw){
  console.log('Google credentials JSON found in environment variables.');
  googleconfig = JSON.parse(googlecredentialsRaw);
}else{
  const localPath = path.join(__dirname, '..', '..', 'config', 'google-credentials.json');
  if (fs.existsSync(localPath)) {
    console.log('✔ Usando credenciales desde archivo local');
    googleConfig = JSON.parse(fs.readFileSync(localPath, 'utf8'));
  } else {
    throw new Error('❌ No se encontraron credenciales de Google Drive ni por variable de entorno ni por archivo local.');
  }
}


@Module({
  controllers: [GoogleApiController],
  providers: [GoogleApiService],
  imports:[
    GoogleDriveModule.register(googleConfig as GoogleDriveConfig, '16uyaU1wkYlYrpBnAZpszhqCf1ndv3kHF'),
    MulterModule.register({
      storage: memoryStorage(), // Configuración para almacenar archivos en la memoria
    }),
  ],
  exports:[
    GoogleApiService
  ]
})
export class GoogleApiModule {}
 */