import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCaratulaDto } from './dto/create-caratula.dto';
import { UpdateCaratulaDto } from './dto/update-caratula.dto';
import { Caratula, CaratulaDocument } from './entities/caratula.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Response } from 'express';
import * as fs from 'fs';
import { assertValidCaratulaMpNumber, assertValidCaseNumber, caratulaTipoToCaseNumberTipo } from 'src/common/case-number.validator';


@Injectable()
export class CaratulasService {
  constructor(
    @InjectModel(Caratula.name)
    private readonly caratulaModel: Model<CaratulaDocument>
  ) { }
  // Servicio 1: Guardar carátula
  async create(dto: CreateCaratulaDto): Promise<Caratula> {
    try {
      dto.numeroDeic = assertValidCaseNumber(caratulaTipoToCaseNumberTipo(dto.tipoCaso), dto.numeroDeic);
      dto.numeroMp = assertValidCaratulaMpNumber(dto.tipoCaso, dto.numeroMp);
      this.normalizeCaratulaText(dto);
      this.validateCaratulaAges(dto);
      const existe = await this.caratulaModel.findOne({ numeroDeic: dto.numeroDeic });
      if (existe) {
        throw new Error(`Ya existe una carátula con número DEIC ${dto.numeroDeic}`);
      }
      return await this.caratulaModel.create(dto);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('❌ Error al guardar carátula:', error);
      const message = error instanceof Error ? error.message : 'Error desconocido';
      throw new BadRequestException(`Error al guardar carátula: ${message}`);
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
    data.numeroDeic = assertValidCaseNumber(caratulaTipoToCaseNumberTipo(data.tipoCaso), data.numeroDeic);
    data.numeroMp = assertValidCaratulaMpNumber(data.tipoCaso, data.numeroMp);
    this.normalizeCaratulaText(data);
    this.validateCaratulaAges(data);
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

    // Dibujar la marca de agua antes de tablas y textos conserva bordes y contenido en negro.
    page.drawImage(marcaAgua, {
      x: 30,
      y: 100,
      width: width - 60,
      height: height - 200,
      opacity: 0.22
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
    let startYDown = 300;

    /*   const rowsDown = [
        ['Nombre del Adolescente/niño:', data.nombre],
        ['Estado del caso', data.observaciones],
        ['Investigador', data.investigador],
  
      ]; */
    const nombresArray = data.tipoCaso === 'Alerta'
      ? [this.appendAge(data.nombre, data.edad)]
      : this.namesWithAges(data.nombre, data.edad);

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

    const maxTableWidthDown = 500;
    const minLabelWidthDown = 120;
    const maxLabelWidthDown = 205;
    const labelPadding = 20;
    const valuePadding = 20;
    const longestLabelWidth = Math.max(...rowsDown.map(([label]) => fontBold.widthOfTextAtSize(label, 12)));
    const longestValueWidth = Math.max(...rowsDown.map(([, value]) => font.widthOfTextAtSize(value, 12)));
    const col1WidthDown = Math.min(maxLabelWidthDown, Math.max(minLabelWidthDown, longestLabelWidth + labelPadding));
    const col2WidthDown = Math.min(maxTableWidthDown - col1WidthDown, Math.max(225, longestValueWidth + valuePadding));
    const tableWidthDown = col1WidthDown + col2WidthDown;
    const startXDown = (width - tableWidthDown) / 2;


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

      const valueFontSize = font.widthOfTextAtSize(rowsDown[i][1], 12) > col2WidthDown - 20 ? 10 : 12;

      page.drawText(rowsDown[i][1], {
        x: startXDown + col1WidthDown + 10,
        y: y - 15,
        size: valueFontSize,
        font: font,
        color: rgb(0, 0, 0),
      });
    }


    const tituloLugar = data.tipoCaso === 'Alerta'
      ? 'Lugar de desaparici\u00f3n'
      : 'Lugar de los hechos';
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

  private normalizeCaratulaText(data: CreateCaratulaDto): void {
    data.nombre = this.toTitleCase(data.nombre);
    data.lugar = this.toTitleCase(data.lugar);
    data.investigador = this.toTitleCase(data.investigador);

    if (data.observaciones) {
      data.observaciones = this.toSentenceCase(data.observaciones);
    }

    if (data.edad) {
      data.edad = data.edad.trim().replace(/\s+/g, ' ');
    }
  }

  private namesWithAges(names: string, ages?: string): string[] {
    const nameList = names.split(',').map((name) => name.trim()).filter(Boolean);
    const ageList = ages?.split(',').map((age) => age.trim()).filter(Boolean) ?? [];

    return nameList.map((name, index) => this.appendAge(name, ageList[index]));
  }

  private appendAge(name: string, age?: string): string {
    return age ? `${name}, de ${age} a\u00f1os de edad` : name;
  }

  private validateCaratulaAges(data: CreateCaratulaDto): void {
    if (!data.edad) {
      throw new BadRequestException('La edad es requerida para generar la caratula.');
    }

    const agePattern = data.tipoCaso === 'Alerta'
      ? /^\d{1,2}$/
      : /^\d{1,2}(?:\s*,\s*\d{1,2})*$/;

    if (!agePattern.test(data.edad)) {
      throw new BadRequestException('El formato de edad no es valido.');
    }

    if (data.tipoCaso !== 'Alerta') {
      const namesCount = data.nombre.split(',').map((name) => name.trim()).filter(Boolean).length;
      const agesCount = data.edad.split(',').map((age) => age.trim()).filter(Boolean).length;

      if (namesCount !== agesCount) {
        throw new BadRequestException('Debe ingresar una edad por cada nombre.');
      }
    }
  }

  private toTitleCase(value?: string): string {
    if (!value) return '';

    const lowerCaseWords = new Set(['a', 'al', 'de', 'del', 'la', 'las', 'los', 'el', 'y', 'o']);

    return value
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('es-GT')
      .split(' ')
      .map((word, index) => {
        if (index > 0 && lowerCaseWords.has(word)) {
          return word;
        }

        return word
          .split('-')
          .map((part) => this.capitalizeWord(part))
          .join('-');
      })
      .join(' ');
  }

  private toSentenceCase(value?: string): string {
    if (!value) return '';

    const normalized = value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-GT');
    return this.capitalizeWord(normalized);
  }

  private capitalizeWord(value: string): string {
    return value ? value.charAt(0).toLocaleUpperCase('es-GT') + value.slice(1) : value;
  }

}
