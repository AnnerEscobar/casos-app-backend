import { BadRequestException, Injectable } from '@nestjs/common';
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
    this.validarFormatoDisponible(informe);

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1417, right: 1701, bottom: 1417, left: 1701, header: 708, footer: 708 }
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
          ...this.entrevistasDinamicas(informe),
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

  private formatearFechaConDia(fecha: any): string {
    if (!fecha) return '';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return this.str(fecha);
    const dias = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const diaMes = String(d.getDate()).padStart(2, '0');
    return `${dias[d.getDay()]} ${diaMes} de ${meses[d.getMonth()]} del ${d.getFullYear()}`;
  }

  private parrafoTitulo(texto: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: texto,
        bold: true,
        size: 24,
        font: 'Arial',
      }),
    ],
  });
}

  private tituloSeccion(texto: string, underline = false): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text: texto, bold: true, underline: underline ? {} : undefined, size: 24, font: 'Arial' })],
      spacing: { before: 160 },
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
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 24, font: 'Arial' })] })],
          width: { size: 60, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: value, size: 24, font: 'Arial' })] })],
          width: { size: 40, type: WidthType.PERCENTAGE },
        }),
      ]
    }));

    return [
      new Paragraph({ text: '' }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'INFORME DE INVESTIGACIÓN', bold: true, size: 32, font: 'Arial' })]
      }),
      new Paragraph({ text: '' }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: `Guatemala, ${fecha}.`, size: 24, font: 'Arial' })]
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
      new Paragraph({ children: [new TextRun({ text: 'A:', size: 24, font: 'Arial' })] }),
      new Paragraph({ children: [new TextRun({ text: informe.datosGenerales?.nombreFiscal || '(Nombre del Auxiliar Fiscal)', size: 24, font: 'Arial' })] }),
      new Paragraph({ children: [new TextRun({ text: 'Auxiliar Fiscal', size: 24, font: 'Arial' })] }),
      new Paragraph({ children: [new TextRun({ text: fiscalia, size: 24, font: 'Arial' })] }),
      new Paragraph({ children: [new TextRun({ text: 'Ministerio Público', size: 24, font: 'Arial' })] }),
      new Paragraph({ children: [new TextRun({ text: 'Presente.', size: 24, font: 'Arial' })] }),
      new Paragraph({ text: '' }),
    ];
  }

  private validarFormatoDisponible(informe: Informe): void {
    const tipoInforme = informe.tipoInforme?.toLowerCase();
    const numeroDeic = informe.numeroDeic?.trim().toUpperCase();
    const formatoValido =
      (tipoInforme === 'alerta' && numeroDeic?.startsWith('DEIC52-')) ||
      (tipoInforme === 'maltrato' && numeroDeic?.startsWith('DEIC51-')) ||
      (tipoInforme === 'conflicto' && numeroDeic?.startsWith('DEIC53-'));

    if (!formatoValido) {
      throw new BadRequestException(
        'El tipo de informe no coincide con el numero DEIC. Usa DEIC52 para alerta, DEIC51 para maltrato o DEIC53 para conflicto.'
      );
    }
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
    const objetoInvestigacion = informe.tipoInforme === 'maltrato'
      ? 'se desarrollen diligencias de investigacion de los hechos cometidos en contra de '
      : informe.tipoInforme === 'conflicto'
        ? 'se desarrollen diligencias de investigacion de los hechos cometidos por '
        : 'se desarrollen diligencias de investigacion para la localizacion de ';

    const t = (text: string, bold = false) =>
      new TextRun({ text, bold, size: 24, font: 'Arial' });

    return [
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 720 },
        children: [
          t('Respetuosamente me dirijo a usted con el objeto de dar respuesta a su requerimiento de fecha '),
          t(fechaReq, true),
          t(', dentro del expediente antes descrito, en el cual solicita '),
          t(objetoInvestigacion),
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
      this.tituloSeccion('1. Hipótesis preliminar del/la investigador/a'),
      new Paragraph({ children: [new TextRun({ text: informe.datosGenerales.hipotesis, size: 24, font: 'Arial' })], alignment: AlignmentType.JUSTIFIED }),
      new Paragraph({ text: '' }),
    ];
  }

  private tablaPerfilVictima(informe: Informe): (Paragraph | Table)[] {
    const perfil = informe.perfilVictima || {};
    const items = this.normalizarPerfilItems(perfil);
    const tipo = informe.tipoInforme;
    const camposParaVictima = (v: any): [string, string][] => {
      const camposBase: [string, string][] = [
        ['Nombre:', this.str(v.nombre)],
        ['Alias:', this.str(v.alias)],
        ['Edad:', this.str(v.edad)],
        ['Fecha de Nacimiento:', this.formatearFecha(v.fechaNacimiento)],
        ['Nacionalidad:', this.str(v.nacionalidad)],
        ['Caracteristicas fisicas:', this.str(v.caracteristicasFisicas)],
        ['Lugar de trabajo:', this.str(v.lugarTrabajo)],
        ['Grado de escolaridad:', this.str(v.escolaridad)],
        ['Centro educativo al que asiste:', this.str(v.centroEducativo)],
        ['Nombre del Padre, Madre, tutores o encargados:', this.str(v.nombrePadres)],
        ['Residencia:', this.str(v.residencia)],
        ['Telefono:', this.str(v.telefono)],
        ['Parentesco o relacion con el sindicado/adolescente:', this.str(v.parentescoSindicado)],
        ['Antecedentes de medidas de proteccion:', this.str(v.antecedentesProteccion)],
        ['Antecedentes de alerta Alba Keneth:', this.str(v.antecedentesAlerta)],
        ['Indicadores de maltrato:', this.str(v.indicadoresMaltrato)],
        ['Hermanos menores de edad:', this.str(v.hermanosmenores)],
        ['Otra informacion relevante:', this.str(v.otraInfo)],
      ];

      if (tipo !== 'conflicto') return camposBase;

      return [
        ['Nombre:', this.str(v.nombre)],
        ['Alias:', this.str(v.alias)],
        ['Edad:', this.str(v.edad)],
        ['Fecha de Nacimiento:', this.formatearFecha(v.fechaNacimiento)],
        ['Estado civil:', this.str(v.estadoCivil)],
        ['Profesion u oficio:', this.str(v.profesion)],
        ['Lugar y direccion de trabajo:', this.str(v.lugarTrabajo)],
        ['Lugar de estudios:', this.str(v.lugarEstudios || v.centroEducativo)],
        ['Codigo Unico de Identificacion Personal:', this.str(v.cui)],
        ['Nacionalidad:', this.str(v.nacionalidad)],
        ['Numero de telefono:', this.str(v.telefono)],
        ['Direccion de residencia:', this.str(v.residencia)],
        ['Pertenencia etnica:', this.str(v.pertenenciaEtnica)],
        ['Identidad de genero y orientacion sexual:', this.str(v.identidadGenero)],
        ['Caracteristicas fisicas:', this.str(v.caracteristicasFisicas)],
        ['Nombre de los Padres:', this.str(v.nombrePadres)],
        ['Flujo migratorio:', this.str(v.flujoMigratorio)],
        ['Parentesco o relacion con el adolescente en conflicto con la ley penal:', this.str(v.parentescoSindicado)],
        ['Discapacidad:', this.str(v.discapacidad)],
        ['Perfiles en redes sociales:', this.str(v.redesSociales)],
        ['Antecedentes policiales:', this.str(v.antecedentesPolicia)],
        ['Otra informacion relevante:', this.str(v.otraInfo)],
      ];
    };

    const bloques = items.map((item, index) => [
      this.tituloSeccion(`2.1.${items.length > 1 ? index + 1 : ''} De la victima`.replace('2.1. De', '2.1. De')),
      this.tablaPerfilBasica(tipo === 'conflicto' ? 'PERFIL DE LA VICTIMA' : 'PERFIL DE LA VICTIMA', camposParaVictima(item), item),
      new Paragraph({ text: '' }),
    ]).flat();

    return [
      this.tituloSeccion('2. Individualizacion y perfilacion'),
      ...bloques,
    ];
  }

  private tablaPerfilSecundario(informe: Informe): (Paragraph | Table)[] {
    const perfil = informe.perfilSecundario || {};
    const items = this.normalizarPerfilItems(perfil);
    const tipo = informe.tipoInforme;
    const titulo = tipo === 'alerta' ? 'PERFIL DEL DENUNCIANTE'
      : tipo === 'maltrato' ? 'PERFIL DEL SINDICADO'
        : 'PERFIL DEL ADOLESCENTE EN CONFLICTO CON LA LEY PENAL';
    const labelSeccion = tipo === 'alerta' ? 'De la persona denunciante'
      : tipo === 'maltrato' ? 'Del sindicado'
        : 'Del adolescente en conflicto con la ley penal';

    const camposParaSecundario = (s: any): [string, string][] => {
      const camposBase: [string, string][] = [
        ['Nombre:', this.str(s.nombre)],
        ['Alias:', this.str(s.alias)],
        ['Edad:', this.str(s.edad)],
        ['Fecha de Nacimiento:', this.formatearFecha(s.fechaNacimiento)],
        ['Estado civil:', this.str(s.estadoCivil)],
        ['Profesion u oficio:', this.str(s.profesion)],
        ['Lugar de trabajo:', this.str(s.lugarTrabajo)],
        ['Documento de identificacion:', this.str(s.documentoIdentificacion)],
        ['Nacionalidad:', this.str(s.nacionalidad)],
        ['Caracteristicas fisicas:', this.str(s.caracteristicasFisicas)],
        ['Nombre de los Padres:', this.str(s.nombrePadres)],
        ['Residencia:', this.str(s.residencia)],
        ['Telefono:', this.str(s.telefono)],
        ['Referencias personales:', this.str(s.referencias)],
        ['Parentesco o relacion con la victima:', this.str(s.parentescoVictima)],
        ['Antecedentes policiacos:', this.str(s.antecedentesPolicia)],
        ['Otra informacion relevante:', this.str(s.otraInfo)],
      ];

      if (tipo !== 'conflicto') return camposBase;

      return [
        ['Nombre:', this.str(s.nombre)],
        ['Alias:', this.str(s.alias)],
        ['Edad:', this.str(s.edad)],
        ['Fecha de Nacimiento:', this.formatearFecha(s.fechaNacimiento)],
        ['Nacionalidad:', this.str(s.nacionalidad)],
        ['Codigo Unico de Identificacion Personal:', this.str(s.cui)],
        ['Caracteristicas fisicas:', this.str(s.caracteristicasFisicas)],
        ['Lugar de trabajo:', this.str(s.lugarTrabajo)],
        ['Grado de escolaridad:', this.str(s.escolaridad)],
        ['Centro educativo al que asiste:', this.str(s.centroEducativo)],
        ['Nombre del Padre, Madre, tutores o encargados:', this.str(s.nombrePadres)],
        ['Residencia:', this.str(s.residencia)],
        ['Telefono:', this.str(s.telefono)],
        ['Parentesco o relacion con la victima:', this.str(s.parentescoVictima)],
        ['Pertenencia etnica:', this.str(s.pertenenciaEtnica)],
        ['Discapacidad:', this.str(s.discapacidad)],
        ['Identidad de genero y orientacion sexual:', this.str(s.identidadGenero)],
        ['Perfiles en redes sociales:', this.str(s.redesSociales)],
        ['Antecedentes de medidas de proteccion:', this.str(s.antecedentesProteccion)],
        ['Antecedentes de alerta Alba Keneth:', this.str(s.antecedentesAlerta)],
        ['Antecedentes de consumo de drogas:', this.str(s.consumoDrogas)],
        ['Antecedentes de ingreso a centros de privacion de libertad para adolescentes:', this.str(s.ingresoCentroPrivacion)],
        ['Parientes privados de libertad:', this.str(s.parientesPrivados)],
        ['Flujo migratorio:', this.str(s.flujoMigratorio)],
        ['Pertenencia a pandillas:', this.str(s.pandillas)],
        ['Parientes en pandillas:', this.str(s.parientesPandillas)],
        ['Tiempo de pertenecer a la mara o pandilla:', this.str(s.tiempoPandilla)],
        ['Nombre de la clica a la que pertenece:', this.str(s.clica)],
        ['Rango o puesto que ejerce:', this.str(s.rangoPandilla)],
        ['Area geografica de operacion criminal:', this.str(s.areaOperacion)],
        ['Metodologia criminal:', this.str(s.metodologiaCriminal)],
        ['Grado de violencia utilizada:', this.str(s.gradoViolencia)],
        ['Otra informacion relevante:', this.str(s.otraInfo)],
      ];
    };

    return items.map((item, index) => [
      this.tituloSeccion(`2.2.${items.length > 1 ? index + 1 : ''} ${labelSeccion}`.replace('2.2. ', '2.2. ')),
      this.tablaPerfilBasica(titulo, camposParaSecundario(item), item),
      new Paragraph({ text: '' }),
    ]).flat();
  }

  private normalizarPerfilItems(perfil: any): any[] {
    if (Array.isArray(perfil?.items)) return perfil.items.filter((item) => this.perfilTieneDatos(item));
    return this.perfilTieneDatos(perfil) ? [perfil] : [{}];
  }

  private perfilTieneDatos(perfil: any): boolean {
    return Object.keys(perfil || {})
      .filter((key) => key !== 'items')
      .some((key) => this.str(perfil[key]).trim());
  }

  private tablaPerfilBasica(titulo: string, campos: [string, string][], perfil: any): Table {
    const FOTO_ROWS = 7;
    const labelCell = (text: string) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 24, font: 'Arial' })] })],
      width: { size: 40, type: WidthType.PERCENTAGE },
    });
    const valueCell = (text: string, wide = false) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, size: 24, font: 'Arial' })] })],
      width: { size: wide ? 60 : 45, type: WidthType.PERCENTAGE },
      ...(wide ? { columnSpan: 2 } : {}),
    });
    const edadCaption = this.str(perfil?.edad) ? `Edad: ${this.str(perfil.edad)} anos` : 'Fotografia NO disponible';
    const dataRows = campos.map(([label, value], i) => {
      if (i === 0) {
        return new TableRow({ children: [
          labelCell(label),
          valueCell(value),
          new TableCell({
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Fotografia NO disponible', size: 16, font: 'Arial', color: '888888' })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: edadCaption, size: 16, font: 'Arial', bold: true })] }),
            ],
            verticalMerge: VerticalMergeType.RESTART,
            width: { size: 15, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
          }),
        ]});
      }
      if (i < FOTO_ROWS) {
        return new TableRow({ children: [
          labelCell(label),
          valueCell(value),
          new TableCell({ children: [new Paragraph({ text: '' })], verticalMerge: VerticalMergeType.CONTINUE, width: { size: 15, type: WidthType.PERCENTAGE } }),
        ]});
      }
      return new TableRow({ children: [labelCell(label), valueCell(value, true)] });
    });

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [new TableCell({
          columnSpan: 3,
          shading: { type: ShadingType.CLEAR, fill: 'D9D9D9' },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: titulo, bold: true, size: 24, font: 'Arial' })] })]
        })] }),
        ...dataRows,
      ],
    });
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
      this.tituloSeccion('3. Entrevistas'),
      ...items.map(([label, value]) => [
        this.tituloSeccion(label),
        ...(value ? [new Paragraph({ children: [new TextRun({ text: value, size: 24, font: 'Arial' })], alignment: AlignmentType.JUSTIFIED })] : []),
      ]).flat(),
      new Paragraph({ text: '' }),
    ];
  }

  private entrevistasDinamicas(informe: Informe): Paragraph[] {
    const items = this.normalizarEntrevistas(informe.entrevistas || {}, informe.tipoInforme);

    return [
      this.tituloSeccion('3. Entrevistas'),
      ...items.map((item, index) => [
        new Paragraph({ children: [new TextRun({ text: `3.${index + 1}. ${item.titulo}`, bold: true, size: 24, font: 'Arial' })] }),
        new Paragraph({
          children: [new TextRun({ text: this.encabezadoEntrevista(item), size: 24, font: 'Arial' })],
          alignment: AlignmentType.JUSTIFIED,
          indent: { firstLine: 720 },
        }),
        ...(item.contenido ? [new Paragraph({
          children: [new TextRun({ text: item.contenido, size: 24, font: 'Arial' })],
          alignment: AlignmentType.JUSTIFIED,
        })] : []),
        new Paragraph({ text: '' }),
      ]).flat(),
      new Paragraph({ text: '' }),
    ];
  }

  private normalizarEntrevistas(entrevistas: any, tipoInforme: string): any[] {
    if (Array.isArray(entrevistas?.items)) {
      return entrevistas.items.filter((item) => item?.titulo || item?.contenido);
    }

    const legacyItems = tipoInforme === 'conflicto'
      ? [
        { titulo: 'Entrevista a la victima', contenido: entrevistas?.victima },
        { titulo: 'Entrevista a testigos', contenido: entrevistas?.denuncianteTestigos },
        { titulo: 'Entrevista a vecinos', contenido: entrevistas?.vecinos },
      ]
      : [
        { titulo: 'Entrevista a padres o encargados', contenido: entrevistas?.padresEncargados },
        { titulo: tipoInforme === 'alerta' ? 'Entrevista a denunciante' : 'Entrevista a testigos', contenido: entrevistas?.denuncianteTestigos },
        { titulo: 'Entrevista a vecinos o posibles testigos', contenido: entrevistas?.vecinos },
      ];

    return legacyItems.filter((item) => item.contenido);
  }

  private encabezadoEntrevista(item: any): string {
    const fecha = this.formatearFecha(item.fecha) || 'fecha no consignada';
    const horaTexto = this.segmentoHora(item.hora);
    const persona = this.detallePersonaEntrevistada(item);

    if (item.modalidad === 'presencial') {
      const lugar = this.str(item.lugar) || 'lugar no consignado';
      return `En fecha ${fecha}${horaTexto}, constituidos en ${lugar}, lugar donde fuimos atendidos por ${persona}, quien en relacion con los hechos que se investigan manifesto lo siguiente:`;
    }

    const telefono = this.str(item.telefono);
    const telefonoTexto = telefono ? ` al numero telefonico ${telefono}` : '';
    const voz = this.str(item.vozAtendio);
    const atendidaPor = voz
      ? `dicha llamada fue atendida por una voz ${voz} quien indico ser ${persona}`
      : `dicha llamada fue atendida por ${persona}`;

    return `En fecha ${fecha}${horaTexto}, realice una llamada telefonica${telefonoTexto}, ${atendidaPor}, quien en relacion con los hechos que se investigan manifesto lo siguiente:`;
  }

  private detallePersonaEntrevistada(item: any): string {
    const partes: string[] = [this.str(item.persona) || 'la persona entrevistada'];
    const edad = this.str(item.edad);
    const estadoCivil = this.str(item.estadoCivil);
    const ocupacion = this.str(item.ocupacion);
    const telefono = this.str(item.telefono);
    const notaIdentificacion = this.str(item.notaIdentificacion);

    if (edad) partes.push(`de ${edad} anos de edad`);
    if (estadoCivil) partes.push(estadoCivil);
    if (ocupacion) partes.push(ocupacion);
    if (item.modalidad === 'presencial' && telefono) partes.push(`numero telefonico ${telefono}`);

    let detalle = partes.join(', ');

    if (notaIdentificacion) {
      detalle += `, ${notaIdentificacion}`;
    } else {
      detalle += this.segmentoDpi(item.dpi);
    }

    detalle += this.segmentoCalidadPersona(item.calidadPersona);
    return detalle;
  }

  private segmentoHora(hora?: string): string {
    const horaLimpia = this.str(hora);
    return horaLimpia ? `, siendo las ${horaLimpia} horas` : '';
  }

  private segmentoDpi(dpi?: string): string {
    const dpiLimpio = this.str(dpi);
    return dpiLimpio ? `, quien se identifico con su documento personal de identificacion DPI numero ${dpiLimpio}` : '';
  }

  private segmentoCalidadPersona(calidad?: string): string {
    const calidadLimpia = this.str(calidad);
    if (!calidadLimpia) return '';

    return /^quien\b/i.test(calidadLimpia)
      ? `, ${calidadLimpia}`
      : `, quien indico ser ${calidadLimpia}`;
  }

  private perfilacionLugar(informe: Informe): Paragraph[] {
    const l = informe.perfilacionLugar || {};
    const fecha = this.formatearFechaConDia(l.fecha || informe.datosGenerales?.fechaDiligencias);
    const fechaSimple = this.formatearFecha(l.fecha || informe.datosGenerales?.fechaDiligencias);
    const hora = this.str(l.hora);
    const ubicacion = this.str(l.ubicacion || l.descripcion);
    const municipioDepartamento = this.str(l.municipioDepartamento);
    const contador = this.str(l.contadorElectrico);
    const coordenadasGps = this.str(l.coordenadasGps);
    const lugarTexto = informe.tipoInforme === 'alerta' ? 'lugar de la desaparicion' : 'lugar de los hechos';
    const tituloLugar = informe.tipoInforme === 'alerta' ? 'de la desaparicion' : 'de los hechos';
    const lugarCamaraTexto = informe.tipoInforme === 'alerta' ? 'lugar de la desaparicion' : 'lugar de los hechos';
    const ubicacionCompleta = [ubicacion, municipioDepartamento].filter(Boolean).join(', ');
    const inicio = [
      hora ? `Siendo las ${hora} horas` : 'Siendo las ____ horas',
      fecha ? `del dia ${fecha}` : 'del dia __________',
      ubicacion ? `constituidos frente al inmueble ubicado en ${ubicacion}` : 'constituidos en el lugar perfilado',
      municipioDepartamento,
    ].filter(Boolean).join(', ');
    const documentacion = l.documentarFotografias !== false
      ? `el suscrito procede a documentar el ${lugarTexto} mediante fotografias.`
      : `el suscrito procede a perfilar el ${lugarTexto}.`;
    const contadorTexto = contador ? ` Referido inmueble cuenta con contador de suministro electrico No. ${contador}.` : '';
    const descripcionAdicional = l.descripcion && l.descripcion !== l.ubicacion ? ` ${l.descripcion}` : '';
    const parrafoPrincipal = `${inicio}, ${documentacion}${contadorTexto}${descripcionAdicional}`.trim();
    const camarasTexto = l.camarasEstado === 'hay' && this.str(l.camaras)
      ? this.str(l.camaras)
      : this.textoDefaultCamaras(fechaSimple, hora, ubicacionCompleta, lugarCamaraTexto);
    const indicadoresTexto = l.indicadoresEstado === 'hay' && this.str(l.indicadoresAmbientales)
      ? this.str(l.indicadoresAmbientales)
      : `En el ${lugarCamaraTexto} no se ubicaron indicadores ambientales de maltrato.`;
    const accesosTexto = this.str(l.accesasSalidas);
    const subtitulo = (texto: string) => new Paragraph({
      children: [new TextRun({ text: texto, bold: true, size: 24, font: 'Arial' })],
      spacing: { before: 160 },
    });
    const parrafo = (texto: string) => new Paragraph({
      children: [new TextRun({ text: texto, size: 24, font: 'Arial' })],
      alignment: AlignmentType.JUSTIFIED,
      indent: { firstLine: 720 },
    });

    return [
      new Paragraph({
        children: [new TextRun({ text: `4. Ubicacion/perfilacion del lugar ${tituloLugar}.`, bold: true, underline: {}, size: 24, font: 'Arial' })],
      }),
      new Paragraph({
        children: [new TextRun({ text: parrafoPrincipal, size: 24, font: 'Arial' })],
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 720 },
        spacing: { before: 240 },
      }),
      ...(coordenadasGps ? [
        subtitulo('4.1. Ubicacion GPS'),
        parrafo(`Se establecieron las coordenadas GPS: ${coordenadasGps}, las cuales fueron tomadas frente al domicilio ubicado en ${ubicacionCompleta || 'el lugar perfilado'}.`),
      ] : []),
      subtitulo(coordenadasGps ? '4.2. Camaras de seguridad' : '4.1. Camaras de seguridad'),
      parrafo(camarasTexto),
      subtitulo(coordenadasGps ? '4.3. Indicadores ambientales de maltrato' : '4.2. Indicadores ambientales de maltrato'),
      parrafo(indicadoresTexto),
      ...(accesosTexto ? [
        subtitulo(coordenadasGps ? '4.4. Accesos y salidas del lugar' : '4.3. Accesos y salidas del lugar'),
        parrafo(accesosTexto),
      ] : []),
      new Paragraph({ text: '' }),
    ];
  }

  private textoDefaultCamaras(fecha: string, hora: string, ubicacion: string, lugarTexto: string): string {
    const fechaTexto = fecha ? `En fecha ${fecha}` : 'En fecha __________';
    const horaTexto = hora ? `, siendo las ${hora} horas` : '';
    const ubicacionTexto = ubicacion ? `, constituidos en ${ubicacion}` : '';
    return `${fechaTexto}${horaTexto}${ubicacionTexto}, no se lograron ubicar camaras de videovigilancia que enfoquen hacia el ${lugarTexto}.`;
  }

  private diligencias(informe: Informe): Paragraph[] {
    const d = informe.diligencias || {};
    const tipo = informe.tipoInforme;

    if (tipo === 'maltrato' || tipo === 'conflicto') {
      return [];
    }

    if (tipo === 'alerta') {
      const visitas = [
        ['5.1. Centros de asistencia médica', d.centrosMedicos || ''],
        ['5.2. INACIF', d.inacif || ''],
      ].filter(([, value]) => value);

      const comunicacion = [
        ['6.1. Oficio de localización al Sistema 110', d.oficio110 || ''],
      ].filter(([, value]) => value);

      const otras = [
        ['7. Otras diligencias de investigación', d.otrasDiligencias || ''],
      ].filter(([, value]) => value);

      return [
        ...(visitas.length ? [
          this.tituloSeccion('5. Visitas a centros asistenciales u otros lugares para la localización del niño, niña o adolescente'),
          ...visitas.map(([label, value]) => [
            this.tituloSeccion(label),
            new Paragraph({ children: [new TextRun({ text: value, size: 24, font: 'Arial' })], alignment: AlignmentType.JUSTIFIED }),
          ]).flat(),
          new Paragraph({ text: '' }),
        ] : []),
        ...(comunicacion.length ? [
          this.tituloSeccion('6. Comunicación a otras dependencias de la PNC u otras instituciones'),
          ...comunicacion.map(([label, value]) => [
            this.tituloSeccion(label),
            new Paragraph({ children: [new TextRun({ text: value, size: 24, font: 'Arial' })], alignment: AlignmentType.JUSTIFIED }),
          ]).flat(),
          new Paragraph({ text: '' }),
        ] : []),
        ...(otras.length ? [
          ...otras.map(([label, value]) => [
            this.tituloSeccion(label),
            new Paragraph({ children: [new TextRun({ text: value, size: 24, font: 'Arial' })], alignment: AlignmentType.JUSTIFIED }),
          ]).flat(),
          new Paragraph({ text: '' }),
        ] : []),
      ];
    }

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
      this.tituloSeccion('5. Diligencias de investigación realizadas'),
      ...items.map(([label, value], index) => [
        this.tituloSeccion(`5.${index + 1}. ${label}`),
        ...(value ? [new Paragraph({ children: [new TextRun({ text: value, size: 24, font: 'Arial' })], alignment: AlignmentType.JUSTIFIED })] : []),
      ]).flat(),
      new Paragraph({ text: '' }),
    ];
  }

  private conclusiones(informe: Informe): Paragraph[] {
    const c = informe.conclusiones || {};
    const titulo = informe.tipoInforme === 'alerta'
      ? '8. Conclusiones de las diligencias de investigacion realizadas'
      : '5. Conclusiones de las diligencias de investigacion realizadas';
    const anexos = c.anexos || 'el anexo I, con informacion que complementa la presente investigacion';
    const observaciones = c.observaciones ||
      `En virtud de haber cumplido con las diligencias de investigacion requeridas, le remito el presente Informe de Investigacion, el cual contienen ${anexos}.`;

    return [
      this.tituloSeccion(titulo),
      ...(c.conclusiones ? [new Paragraph({ children: [new TextRun({ text: c.conclusiones, size: 24, font: 'Arial' })], alignment: AlignmentType.JUSTIFIED })] : []),
      new Paragraph({ text: '' }),
      this.tituloSeccion('OBSERVACIONES:'),
      ...(observaciones ? [new Paragraph({ children: [new TextRun({ text: observaciones, size: 24, font: 'Arial' })], alignment: AlignmentType.JUSTIFIED })] : []),
      new Paragraph({ text: '' }),
    ];
  }

  private cierre(informe: Informe): Paragraph[] {
    return [
      new Paragraph({ children: [new TextRun({ text: 'Sin otro particular,', size: 24, font: 'Arial' })] }),
      new Paragraph({ text: '' }),
      new Paragraph({ text: '' }),
    ];
  }

  private tablaFirmas(): (Paragraph | Table)[] {
    const firmaBorders = {
      top: { style: BorderStyle.DOTTED, size: 1, color: '999999' },
      bottom: { style: BorderStyle.DOTTED, size: 1, color: '999999' },
      left: { style: BorderStyle.DOTTED, size: 1, color: '999999' },
      right: { style: BorderStyle.DOTTED, size: 1, color: '999999' },
    };
    const textoCentrado = (texto: string) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: texto, size: 24, font: 'Arial' })],
      });
    const celda = (children: Paragraph[]) => new TableCell({
      children,
      borders: firmaBorders,
      width: { size: 50, type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 120, bottom: 120, left: 120, right: 120 },
    });

    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              celda([
                textoCentrado('Agente de PNC'),
                new Paragraph({ text: '' }),
                textoCentrado('Anner Ronaldo Escobar Cruz'),
                textoCentrado('Investigador DEIC'),
              ]),
              celda([new Paragraph({ text: '' })]),
            ],
          }),
          new TableRow({
            children: [
              celda([new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Vo.Bo.', size: 24, font: 'Arial' })] })]),
              celda([textoCentrado('Subinspector de PNC')]),
            ],
          }),
          new TableRow({
            children: [
              celda([new Paragraph({ text: '' })]),
              celda([
                textoCentrado('Marlon Manrique Perez Orozco'),
                textoCentrado('Jefe Accidental'),
                textoCentrado('Departamento de Investigacion de'),
                textoCentrado('Delitos Contra La Ninez y'),
                textoCentrado('Adolescencia y Adolescentes en'),
                textoCentrado('Conflicto con La Ley Penal'),
              ]),
            ],
          }),
        ],
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
