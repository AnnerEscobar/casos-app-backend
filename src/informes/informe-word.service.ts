import { Injectable } from '@nestjs/common';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel,
  ShadingType, VerticalAlign, ImageRun, VerticalMergeType, Header, Footer
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import { Informe } from './entities/informe.entity';

@Injectable()
export class InformeWordService {

  async generarWord(informe: Informe): Promise<Buffer> {
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 1800, right: 1000, bottom: 1000, left: 1200 }
          }
        },
        headers: {
          default: this.encabezadoInstitucional(informe.tipoInforme),
        },
        footers: {
          default: this.pieDePagina(),
        },
        children: [
          ...this.tablaIdentificadores(informe),
          ...this.dirigidoA(informe),
          ...this.introduccion(informe),
          ...this.hipotesis(informe),
          ...this.tablaPerfilVictima(informe),
          ...this.tablaPerfilSecundario(informe),
          ...this.entrevistas(informe),
          ...this.perfilacionLugar(informe),
          ...this.diligencias(informe),
          ...this.conclusiones(informe),
          ...this.cierre(informe),
          ...this.tablaFirmas(),
        ]
      }]
    });

    return await Packer.toBuffer(doc);
  }

  private str(val: any): string {
    if (val === undefined || val === null || val === '') return '';
    return String(val);
  }

  private formatearFecha(fecha: any): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return this.str(fecha);
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return `${d.getDate()} de ${meses[d.getMonth()]} del ${d.getFullYear()}`;
  }

  private parrafoTitulo(texto: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: texto,
        bold: true,
        size: 20,
        font: 'Arial',
      }),
    ],
  });
}

  private encabezadoInstitucional(tipo: string): Header {
    const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const borders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

    const loadImg = (filePath: string, width: number, height: number) => {
      if (!fs.existsSync(filePath)) return null;
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase().replace('.', '') as 'png' | 'jpg' | 'gif' | 'bmp';
      return new ImageRun({ type: ext, data, transformation: { width, height } });
    };

    const informesAssets = path.join(__dirname, 'assets');
    const globalAssets  = path.join(__dirname, '..', 'assets');

    const imgGobernacion = loadImg(path.join(informesAssets, 'logo-gobernacion.png'), 130, 65);
    const imgPnc         = loadImg(path.join(informesAssets, 'logo-pnc.png'), 65, 65);
    const imgTexto       = loadImg(path.join(globalAssets, 'texto-institucional.png'), 300, 75);

    const logoCell = (img: ImageRun | null, align: string) => new TableCell({
      children: [new Paragraph({
        alignment: align as any,
        children: img ? [img] : [],
      })],
      width: { size: 15, type: WidthType.PERCENTAGE },
      borders,
      verticalAlign: VerticalAlign.CENTER,
    });

    const tabla = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
      rows: [new TableRow({
        children: [
          logoCell(imgGobernacion, AlignmentType.LEFT),
          new TableCell({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: imgTexto ? [imgTexto] : [],
            })],
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders,
            verticalAlign: VerticalAlign.CENTER,
          }),
          logoCell(imgPnc, AlignmentType.RIGHT),
        ]
      })]
    });

    return new Header({ children: [tabla] });
  }

  private tablaIdentificadores(informe: Informe): (Paragraph | Table)[] {
    const fecha = this.formatearFecha(informe.datosGenerales?.fechaInforme) || '___________________';

    const filas: [string, string][] = [
      ['N° de identificación de caso interno:', informe.numeroDeic || ''],
      ['N° de expediente del Ministerio Público:', informe.numeroMp || ''],
    ];

    if (informe.tipoInforme === 'alerta') {
      filas.push(['N° de Alerta Alba Keneth:', informe.datosGenerales?.['numeroAlerta'] || '']);
    }

    const rows = filas.map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, font: 'Arial' })] })],
          width: { size: 60, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: value, size: 20, font: 'Arial' })] })],
          width: { size: 40, type: WidthType.PERCENTAGE },
        }),
      ]
    }));

    return [
      new Paragraph({ text: '' }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'INFORME DE INVESTIGACIÓN', bold: true, size: 24, font: 'Arial' })]
      }),
      new Paragraph({ text: '' }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: `Guatemala, ${fecha}.`, size: 20, font: 'Arial' })]
      }),
      new Paragraph({ text: '' }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
      new Paragraph({ text: '' }),
    ];
  }

  private dirigidoA(informe: Informe): Paragraph[] {
    const fiscalia = informe.tipoInforme === 'conflicto'
      ? 'Fiscalía de Adolescentes en Conflicto con la Ley Penal'
      : 'Fiscalía de la Niñez y Adolescencia';

    return [
      new Paragraph({ children: [new TextRun({ text: 'A:', size: 20, font: 'Arial' })] }),
      new Paragraph({ children: [new TextRun({ text: informe.datosGenerales?.nombreFiscal || '(Nombre del Auxiliar Fiscal)', size: 20, font: 'Arial' })] }),
      new Paragraph({ children: [new TextRun({ text: 'Auxiliar Fiscal', size: 20, font: 'Arial' })] }),
      new Paragraph({ children: [new TextRun({ text: fiscalia, size: 20, font: 'Arial' })] }),
      new Paragraph({ children: [new TextRun({ text: 'Ministerio Público', size: 20, font: 'Arial' })] }),
      new Paragraph({ children: [new TextRun({ text: 'Presente.', size: 20, font: 'Arial' })] }),
      new Paragraph({ text: '' }),
    ];
  }

  private introduccion(informe: Informe): Paragraph[] {
    const dg = informe.datosGenerales || {};
    const v  = informe.perfilVictima  || {};

    const fechaReq = this.formatearFecha(dg.fechaRequerimiento) || '___';
    const fechaDil = this.formatearFecha(dg.fechaDiligencias)   || '___';
    const nombre   = this.str(v.nombre)             || '___';
    const edad     = this.str(v.edad)               || '___';
    const acomp    = this.str(dg.nombreAcompanante) || '___';
    const vehiculo = this.str(dg.vehiculo)          || '___';
    const genero   = informe.tipoInforme === 'conflicto' ? 'el adolescente' : 'la menor';

    const t = (text: string, bold = false) =>
      new TextRun({ text, bold, size: 20, font: 'Arial' });

    return [
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 720 },
        children: [
          t('Respetuosamente me dirijo a usted, con la finalidad de dar respuesta a su requerimiento de fecha '),
          t(fechaReq, true),
          t(', dentro del expediente antes descrito, en el cual solicita se desarrollen diligencias de investigación de los posibles hechos cometidos en de '),
          t(genero + ', '),
          t(nombre, true),
          t(' de '),
          t(edad + ' años de edad.', true),
        ],
      }),
      new Paragraph({ text: '' }),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 720 },
        children: [
          t('En tal sentido y de conformidad a los lineamientos establecidos en su requerimiento, le informo que en fecha '),
          t(fechaDil, true),
          t(', el suscrito, acompañado de los investigadores, '),
          t(acomp, true),
          t(', a bordo del vehículo policial '),
          t(vehiculo, true),
          t(', al servicio de este departamento, realizamos las siguientes diligencias de investigación:'),
        ],
      }),
      new Paragraph({ text: '' }),
    ];
  }

  private hipotesis(informe: Informe): Paragraph[] {
    if (!informe.datosGenerales?.hipotesis) return [];
    return [
      new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: 'Hipotesis Preliminar', bold: true, size: 20, font: 'Arial' })] }),
      new Paragraph({ children: [new TextRun({ text: informe.datosGenerales.hipotesis, size: 20, font: 'Arial' })], alignment: AlignmentType.JUSTIFIED }),
      new Paragraph({ text: '' }),
    ];
  }

  private tablaPerfilVictima(informe: Informe): (Paragraph | Table)[] {
    this.parrafoTitulo('3. Perfilación')
    const v = informe.perfilVictima || {};
    const titulo = 'PERFIL DE LA VÍCTIMA';
    const FOTO_ROWS = 7;

    const campos: [string, string][] = [
      ['Nombre:', this.str(v.nombre)],
      ['Alias:', this.str(v.alias)],
      ['Edad:', this.str(v.edad)],
      ['Fecha de Nacimiento:', this.formatearFecha(v.fechaNacimiento)],
      ['Nacionalidad:', this.str(v.nacionalidad)],
      ['Características físicas:', this.str(v.caracteristicasFisicas)],
      ['Lugar de trabajo:', this.str(v.lugarTrabajo)],
      ['Grado de escolaridad:', this.str(v.escolaridad)],
      ['Centro educativo al que asiste:', this.str(v.centroEducativo)],
      ['Nombre del Padre, Madre, tutores o encargados:', this.str(v.nombrePadres)],
      ['Residencia:', this.str(v.residencia)],
      ['Teléfono:', this.str(v.telefono)],
      ['Parentesco o relación con el sindicado:', this.str(v.parentescoSindicado)],
      ['Antecedentes de medidas de protección:', this.str(v.antecedentesProteccion)],
      ['Antecedentes de alerta Alba Keneth:', this.str(v.antecedentesAlerta)],
      ['Indicadores de maltrato:', this.str(v.indicadoresMaltrato)],
      ['Hermanos menores de edad:', this.str(v.hermanosmenores)],
      ['Otra información relevante:', this.str(v.otraInfo)],
    ];

    const edadCaption = this.str(v.edad) ? `Edad: ${this.str(v.edad)} años` : 'Fotografía NO disponible';

    const labelCell = (text: string) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18, font: 'Arial' })] })],
      width: { size: 40, type: WidthType.PERCENTAGE },
    });

    const valueCell = (text: string, wide = false) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, size: 18, font: 'Arial' })] })],
      width: { size: wide ? 60 : 45, type: WidthType.PERCENTAGE },
      ...(wide ? { columnSpan: 2 } : {}),
    });

    const dataRows = campos.map(([label, value], i) => {
      if (i === 0) {
        return new TableRow({ children: [
          labelCell(label),
          valueCell(value),
          new TableCell({
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Fotografía NO disponible', size: 16, font: 'Arial', color: '888888' })] }),
            ],
            verticalMerge: VerticalMergeType.RESTART,
            width: { size: 15, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
          }),
        ]});
      } else if (i < FOTO_ROWS) {
        return new TableRow({ children: [
          labelCell(label),
          valueCell(value),
          new TableCell({
            children: [new Paragraph({ text: '' })],
            verticalMerge: VerticalMergeType.CONTINUE,
            width: { size: 15, type: WidthType.PERCENTAGE },
          }),
        ]});
      } else {
        return new TableRow({ children: [labelCell(label), valueCell(value, true)] });
      }
    });

    return [
      new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: 'texto', bold: true, size: 20, font: 'Arial' })] }),
      new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: 'texto', bold: true, size: 20, font: 'Arial' })] }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [new TableCell({
            columnSpan: 3,
            shading: { type: ShadingType.CLEAR, fill: 'D9D9D9' },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: titulo, bold: true, size: 20, font: 'Arial' })] })]
          })] }),
          ...dataRows,
        ]
      }),
      new Paragraph({ text: '' }),
    ];
  }

  private tablaPerfilSecundario(informe: Informe): (Paragraph | Table)[] {
    const s = informe.perfilSecundario || {};
    const tipo = informe.tipoInforme;

    const titulo = tipo === 'alerta' ? 'PERFIL DEL DENUNCIANTE'
      : tipo === 'maltrato' ? 'PERFIL DEL SINDICADO'
        : 'PERFIL DEL ADOLESCENTE EN CONFLICTO CON LA LEY PENAL';

    const labelSeccion = tipo === 'alerta' ? 'De la persona denunciante'
      : tipo === 'maltrato' ? 'Del sindicado'
        : 'Individualización y perfilación del adolescente en conflicto con la ley penal';

    const camposBase: [string, string][] = [
      ['Nombre:', this.str(s.nombre)],
      ['Alias:', this.str(s.alias)],
      ['Edad:', this.str(s.edad)],
      ['Fecha de Nacimiento:', this.formatearFecha(s.fechaNacimiento)],
      ['Nacionalidad:', this.str(s.nacionalidad)],
      ['Características físicas:', this.str(s.caracteristicasFisicas)],
      ['Lugar de trabajo:', this.str(s.lugarTrabajo)],
      ['Documento de identificación:', this.str(s.documentoIdentificacion)],
      ['Nombre de los Padres:', this.str(s.nombrePadres)],
      ['Residencia:', this.str(s.residencia)],
      ['Teléfono:', this.str(s.telefono)],
      ['Referencias personales:', this.str(s.referencias)],
      ['Parentesco o relación con la víctima:', this.str(s.parentescoVictima)],
      ['Antecedentes policiacos:', this.str(s.antecedentesPolicia)],
      ['Otra información relevante:', this.str(s.otraInfo)],
    ];

    const camposAclp: [string, string][] = [
      ['Código Único de Identificación Personal:', s.cui || ''],
      ['Pertenencia étnica:', s.pertenenciaEtnica || ''],
      ['Discapacidad:', s.discapacidad || ''],
      ['Identidad de género y orientación sexual:', s.identidadGenero || ''],
      ['Perfiles en redes sociales:', s.redesSociales || ''],
      ['Antecedentes de medidas de protección:', s.antecedentesProteccion || ''],
      ['Antecedentes de alerta Alba Keneth:', s.antecedentesAlerta || ''],
      ['Antecedentes de consumo de drogas:', s.consumoDrogas || ''],
      ['Antecedentes de ingreso a centros de privación:', s.ingresoCentroPrivacion || ''],
      ['Parientes privados de libertad:', s.parientesPrivados || ''],
      ['Flujo migratorio:', s.flujoMigratorio || ''],
      ['Pertenencia a pandillas:', s.pandillas || ''],
      ['Parientes en pandillas:', s.parientesPandillas || ''],
    ];

    const campos = tipo === 'conflicto' ? [...camposBase, ...camposAclp] : camposBase;
    const FOTO_ROWS = 7;
    const edadCaption = this.str(s.edad) ? `Edad: ${this.str(s.edad)} años` : 'Fotografía NO disponible';

    const labelCell = (text: string) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18, font: 'Arial' })] })],
      width: { size: 40, type: WidthType.PERCENTAGE },
    });
    const valueCell = (text: string, wide = false) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, size: 18, font: 'Arial' })] })],
      width: { size: wide ? 60 : 45, type: WidthType.PERCENTAGE },
      ...(wide ? { columnSpan: 2 } : {}),
    });

    const dataRows = campos.map(([label, value], i) => {
      if (i === 0) {
        return new TableRow({ children: [
          labelCell(label), valueCell(value),
          new TableCell({
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Fotografía NO disponible', size: 16, font: 'Arial', color: '888888' })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: edadCaption, size: 16, font: 'Arial', bold: true })] }),
            ],
            verticalMerge: VerticalMergeType.RESTART,
            width: { size: 15, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
          }),
        ]});
      } else if (i < FOTO_ROWS) {
        return new TableRow({ children: [
          labelCell(label), valueCell(value),
          new TableCell({ children: [new Paragraph({ text: '' })], verticalMerge: VerticalMergeType.CONTINUE, width: { size: 15, type: WidthType.PERCENTAGE } }),
        ]});
      } else {
        return new TableRow({ children: [labelCell(label), valueCell(value, true)] });
      }
    });

    return [
      new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: 'texto', bold: true, size: 20, font: 'Arial' })] }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [new TableCell({
            columnSpan: 3,
            shading: { type: ShadingType.CLEAR, fill: 'D9D9D9' },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: titulo, bold: true, size: 20, font: 'Arial' })] })]
          })] }),
          ...dataRows,
        ]
      }),
      new Paragraph({ text: '' }),
    ];
  }

  private entrevistas(informe: Informe): Paragraph[] {
    const e = informe.entrevistas || {};
    const items: [string, string][] = informe.tipoInforme === 'conflicto'
      ? [
        ['Entrevista a la víctima', e.victima || ''],
        ['Entrevista a testigos', e.denuncianteTestigos || ''],
        ['Entrevista a vecinos', e.vecinos || ''],
      ]
      : [
        ['Padres o encargados del niño/a víctima', e.padresEncargados || ''],
        [informe.tipoInforme === 'alerta' ? 'Denunciante' : 'Testigos', e.denuncianteTestigos || ''],
        ['Vecinos o posibles testigos', e.vecinos || ''],
      ];

    return [
      new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: 'texto', bold: true, size: 20, font: 'Arial' })] }),
      ...items.map(([label, value]) => [
        new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: 'texto', bold: true, size: 20, font: 'Arial' })] }),
        ...(value ? [new Paragraph({ children: [new TextRun({ text: value, size: 20, font: 'Arial' })], alignment: AlignmentType.JUSTIFIED })] : []),
      ]).flat(),
      new Paragraph({ text: '' }),
    ];
  }

  private perfilacionLugar(informe: Informe): Paragraph[] {
    const l = informe.perfilacionLugar || {};
    return [
      new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: 'texto', bold: true, size: 20, font: 'Arial' })] }),
      ...(l.descripcion ? [new Paragraph({ children: [new TextRun({ text: l.descripcion, size: 20, font: 'Arial' })], alignment: AlignmentType.JUSTIFIED })] : []),
      new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: 'texto', bold: true, size: 20, font: 'Arial' })] }),
      ...(l.camaras ? [new Paragraph({ children: [new TextRun({ text: l.camaras, size: 20, font: 'Arial' })], alignment: AlignmentType.JUSTIFIED })] : []),
      new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: 'texto', bold: true, size: 20, font: 'Arial' })] }),
      ...(l.indicadoresAmbientales ? [new Paragraph({ children: [new TextRun({ text: l.indicadoresAmbientales, size: 20, font: 'Arial' })], alignment: AlignmentType.JUSTIFIED })] : []),
      new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: 'texto', bold: true, size: 20, font: 'Arial' })] }),
      ...(l.accesasSalidas ? [new Paragraph({ children: [new TextRun({ text: l.accesasSalidas, size: 20, font: 'Arial' })], alignment: AlignmentType.JUSTIFIED })] : []),
      new Paragraph({ text: '' }),
    ];
  }

  private diligencias(informe: Informe): Paragraph[] {
    const d = informe.diligencias || {};
    const tipo = informe.tipoInforme;

    const items: [string, string][] = tipo === 'alerta' ? [
      ['Visitas a centros asistenciales u otros lugares', d.centrosAsistenciales || ''],
      ['Juzgados', d.juzgados || ''],
      ['Centros de asistencia médica', d.centrosMedicos || ''],
      ['Bomberos', d.bomberos || ''],
      ['Hogares de protección y abrigo', d.hogaresProteccion || ''],
      ['INACIF', d.inacif || ''],
      ['Centros de detención juvenil', d.centrosDetencion || ''],
      ['Comunicación a otras dependencias de la PNC', d.comunicacionPnc || ''],
      ['Oficio de localización al Sistema 110', d.oficio110 || ''],
      ['Oficio de coordinación con otras Delegaciones de la DEIC', d.oficioDelegaciones || ''],
      ['Oficio de localización a Dirección General de Migración', d.oficioDireccionMigracion || ''],
      ['Oficio de conocimiento del movimiento migratorio a INTERPOL', d.oficioInterpol || ''],
      ['Otras diligencias de investigación', d.otrasDiligencias || ''],
      ['Contacto a personal policial — búsqueda inmediata primeras 6 horas', d.busquedaInmediata || ''],
    ] : tipo === 'maltrato' ? [
      ['Otras diligencias de investigación', d.otrasDiligencias || ''],
    ] : [
      ['Solicitud de orden de conducción', d.solicitudOrdenConduccion || ''],
      ['Solicitud de orden de allanamiento, inspección, registro y secuestro', d.solicitudAllanamiento || ''],
      ['Solicitud de autorización de métodos especiales de investigación', d.metodosEspeciales || ''],
      ['Solicitud de exhibiciones personales', d.exhibicionesPersonales || ''],
      ['Otras diligencias de investigación', d.otrasDiligencias || ''],
    ];

    return [
      ...items.map(([label, value]) => [
        new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: 'texto', bold: true, size: 20, font: 'Arial' })] }),
        ...(value ? [new Paragraph({ children: [new TextRun({ text: value, size: 20, font: 'Arial' })], alignment: AlignmentType.JUSTIFIED })] : []),
      ]).flat(),
      new Paragraph({ text: '' }),
    ];
  }

  private conclusiones(informe: Informe): Paragraph[] {
    const c = informe.conclusiones || {};
    return [
      new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: 'texto', bold: true, size: 20, font: 'Arial' })] }),
      ...(c.conclusiones ? [new Paragraph({ children: [new TextRun({ text: c.conclusiones, size: 20, font: 'Arial' })], alignment: AlignmentType.JUSTIFIED })] : []),
      new Paragraph({ text: '' }),
      new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: 'texto', bold: true, size: 20, font: 'Arial' })] }),
      ...(c.observaciones ? [new Paragraph({ children: [new TextRun({ text: c.observaciones, size: 20, font: 'Arial' })], alignment: AlignmentType.JUSTIFIED })] : []),
      new Paragraph({ text: '' }),
    ];
  }

  private cierre(informe: Informe): Paragraph[] {
    const anexos = informe.conclusiones?.anexos || '1) fotocopia de certificación de la partida de nacimiento; 2) fotocopia de las medidas de protección; etc.';
    return [
      new Paragraph({
        children: [new TextRun({ text: `En virtud de haber cumplido con las diligencias de investigación requeridas, le remito el presente Informe de Investigación, al cual se le adjuntan los anexos siguientes: ${anexos}`, size: 20, font: 'Arial' })],
        alignment: AlignmentType.JUSTIFIED,
      }),
      new Paragraph({ text: '' }),
      new Paragraph({ children: [new TextRun({ text: 'Sin otro particular,', size: 20, font: 'Arial' })] }),
      new Paragraph({ text: '' }),
      new Paragraph({ text: '' }),
    ];
  }

  private tablaFirmas(): (Paragraph | Table)[] {
    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Agente de PNC', size: 18, font: 'Arial' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Anner Ronaldo Escobar Cruz', bold: true, size: 18, font: 'Arial' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Investigador DEIC', size: 18, font: 'Arial' })] }),
                ]
              }),
              new TableCell({
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Vo.Bo.', bold: true, size: 18, font: 'Arial' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Subinspector de PNC', size: 18, font: 'Arial' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Marlon Manrique Perez Orozco', bold: true, size: 18, font: 'Arial' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Jefe Accidental Departamento de Investigación', size: 18, font: 'Arial' })] }),
                ]
              }),
            ]
          })
        ]
      }),
      new Paragraph({ text: '' }),
    ];
  }

  private pieDePagina(): Footer {
    const globalAssets = path.join(__dirname, '..', 'assets');
    const imgPath = path.join(globalAssets, 'pie-pagina.png');

    const children: (Paragraph | Table)[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '2ª. CALLE 11-23 COLONIA LOURDES ZONA 16, CIUDAD DE GUATEMALA', size: 16, font: 'Arial' })],
      }),
    ];

    if (fs.existsSync(imgPath)) {
      const data = fs.readFileSync(imgPath);
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: 'png', data, transformation: { width: 400, height: 50 } })],
      }));
    }

    return new Footer({ children });
  }
}