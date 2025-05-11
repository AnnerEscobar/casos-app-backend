import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCaratulaDto } from './dto/create-caratula.dto';
import { UpdateCaratulaDto } from './dto/update-caratula.dto';
import { Caratula, CaratulaDocument } from './entities/caratula.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Response } from 'express';
import * as fs from 'fs';


@Injectable()
export class CaratulasService {
  constructor(
    @InjectModel(Caratula.name)
    private readonly caratulaModel: Model<CaratulaDocument>
  ) { }
  // Servicio 1: Guardar carátula
  async create(dto: CreateCaratulaDto): Promise<Caratula> {
    try {
      const existe = await this.caratulaModel.findOne({ numeroDeic: dto.numeroDeic });
      if (existe) {
        throw new Error(`Ya existe una carátula con número DEIC ${dto.numeroDeic}`);
      }
      return await this.caratulaModel.create(dto);
    } catch (error) {
      console.error('❌ Error al guardar carátula:', error);
      throw new BadRequestException(`Error al guardar carátula: ${error.message}`);
    }
  }

  

  async findAll(): Promise<Caratula[]> {
    return this.caratulaModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(numeroDeic: string): Promise<Caratula> {
    const caratula = await this.caratulaModel.findOne({ numeroDeic });
    if (!caratula) {
      throw new NotFoundException(`No se encontró una carátula con número DEIC ${numeroDeic}`);
    }
    return caratula;
  }

  async remove(numeroDeic: string): Promise<void> {
    const result = await this.caratulaModel.deleteOne({ numeroDeic });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`No se pudo eliminar la carátula con número DEIC ${numeroDeic}`);
    }
  }


  // Servicio 2: Generar el PDF (solo genera y responde)
  async generarCaratulaPDF(data: CreateCaratulaDto, res: Response) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // Tamaño A4
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Cargar imágenes
    const logoGobBytes = fs.readFileSync('./src/assets/logo-ministerio-gobernacion.png');
    const logoPncBytes = fs.readFileSync('./src/assets/logo-pnc.png');
    const marcaAguaBytes = fs.readFileSync('./src/assets/marca-agua-pnc.png');
    const redesBytes = fs.readFileSync('./src/assets/footer-pnc-redes.png');
    const textoInstitucional = fs.readFileSync('./src/assets/texto-institucional.png');

    const logoGob = await pdfDoc.embedPng(logoGobBytes);
    const logoPnc = await pdfDoc.embedPng(logoPncBytes);
    const marcaAgua = await pdfDoc.embedPng(marcaAguaBytes);
    const redes = await pdfDoc.embedPng(redesBytes);
    const textoInstitucionalImg = await pdfDoc.embedPng(textoInstitucional);

    // Dibujar encabezados
    page.drawImage(logoGob, { x: 30, y: height - 80, width: 130, height: 50 });
    page.drawImage(logoPnc, { x: width - 90, y: height - 80, width: 50, height: 50 });
    page.drawImage(textoInstitucionalImg, { x: width / 2 - 120, y: height - 80, width: 300, height: 65 });

    // titulo del tipo de caso
    page.drawText(data.tipoCaso.toUpperCase(), {
      x: width / 2 - font.widthOfTextAtSize(data.tipoCaso.toUpperCase(), 28) / 2,
      y: height - 150,
      size: 28,
      font: fontBold,
      color: rgb(0, 0, 0)
    });

    //dibuja tabla de identificadores del caso
    const rowHeight = 30;
    const col1Width = 200;
    const col2Width = 200;
    const startX = 100;
    let startY = 650;

    const rows = [
      ['Numero de caso Interno:', data.numeroDeic],
      ['Numero de Expediente MP', data.numeroMp],
    ];

    if (data.tipoCaso === 'Alerta') {
      rows.push(['Numero de Alerta', data.numeroAlerta]);
    }

    for (let i = 0; i < rows.length; i++) {
      const y = startY - i * rowHeight;


      // Dibuja los rectangulos de las columnas
      page.drawRectangle({
        x: startX,
        y: y - rowHeight,
        width: col1Width,
        height: rowHeight,
        borderWidth: 1,
        borderColor: rgb(0, 0, 0),
      });

      page.drawRectangle({
        x: startX + col1Width,
        y: y - rowHeight,
        width: col2Width,
        height: rowHeight,
        borderWidth: 1,
        borderColor: rgb(0, 0, 0),
      });


      //controlan y dibujan el texto y de los identificadores del caso
      page.drawText(rows[i][0], {
        x: startX + 10,
        y: y - 15,
        size: 12,
        font: fontBold,
        color: rgb(0, 0, 0),
      });

      page.drawText(rows[i][1], {
        x: startX + col1Width + 10,
        y: y - 15,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
    }


    //dibuja tabla de con datos del adolescente o ni;o
    const rowHeightDown = 30;
    const col1WidthDown = 225;
    const col2WidthDown = 225;
    const startXDown = 75;
    let startYDown = 300;

    /*   const rowsDown = [
        ['Nombre del Adolescente/niño:', data.nombre],
        ['Estado del caso', data.observaciones],
        ['Investigador', data.investigador],
  
      ]; */
    const nombresArray = data.nombre.split(',').map(n => n.trim());

    const rowsDown: string[][] = [];

    // Generar una fila por cada nombre
    nombresArray.forEach((n, index) => {
      const label = data.tipoCaso === 'Maltrato'
        ? 'Nombre del Adolescente/niño:'
        : data.tipoCaso === 'Conflicto'
          ? 'Infractor:'
          : 'Desaparecido(a):';

      rowsDown.push([index === 0 ? label : '', n]);
    });

    rowsDown.push(['Estado del caso', data.observaciones]);
    rowsDown.push(['Investigador', data.investigador]);


    for (let i = 0; i < rowsDown.length; i++) {
      const y = startYDown - i * rowHeight;

      // Dibuja los rectangulos de las columnas
      page.drawRectangle({
        x: startXDown,
        y: y - rowHeightDown,
        width: col1WidthDown,
        height: rowHeightDown,
        borderWidth: 1,
        borderColor: rgb(0, 0, 0),
      });

      page.drawRectangle({
        x: startXDown + col1WidthDown,
        y: y - rowHeight,
        width: col2WidthDown,
        height: rowHeightDown,
        borderWidth: 1,
        borderColor: rgb(0, 0, 0),

      });

      //controlan y dibujan el texto y de los identificadores del caso
      page.drawText(rowsDown[i][0], {
        x: startXDown + 10,
        y: y - 15,
        size: 12,
        font: fontBold,
        color: rgb(0, 0, 0),
      });

      page.drawText(rowsDown[i][1], {
        x: startXDown + col1WidthDown + 10,
        y: y - 15,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
    }


    //controla y dibuja la marca de agua
    page.drawImage(marcaAgua, {
      x: 30,
      y: 100,
      width: width - 60,
      height: height - 200,
      opacity: 0.5
    });

    const tituloLugar = 'Lugar de los hechos / desaparición';
    const tituloLugarWidth = fontBold.widthOfTextAtSize(tituloLugar, 12);

    page.drawText(tituloLugar, {
      x: (width - tituloLugarWidth) / 2,
      y: 420,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    const direccionHechos = data.lugar;
    const direccionWidth = font.widthOfTextAtSize(direccionHechos, 11);

    page.drawText(direccionHechos, {
      x: (width - direccionWidth) / 2,
      y: 400,
      size: 11,
      font: font,
      color: rgb(0, 0, 0),
    });


    // controlan y dibuja el pie de pagina
    page.drawText('2 calle 11-23, colonia Lourdes zona 16, Ciudad de Guatemala.', {
      x: width / 2 - 140,
      y: 70,
      size: 9,
      font: font,
      color: rgb(0, 0, 0)
    });

    page.drawImage(redes, {
      x: width / 2 - 75,
      y: 20,
      width: 150,
      height: 40
    });

    //se encarga de guardar el pdf
    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Caratula-${data.numeroDeic}.pdf`);
    res.send(Buffer.from(pdfBytes));
  }


  async findPendientesPaginated(skip: number, limit: number): Promise<Caratula[]> {
    return this.caratulaModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).exec();
  }
  
  async countPendientes(): Promise<number> {
    return this.caratulaModel.countDocuments();
  }


}
