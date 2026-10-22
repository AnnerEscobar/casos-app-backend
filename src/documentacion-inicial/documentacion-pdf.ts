import { BadRequestException } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PDFDocument } from 'pdf-lib';
const PdfPrinter = require('pdfmake');

interface CampoFormato {
  path: string; x: number; y: number; width: number; height: number;
  fontSize: number; font: string; align: string; label: string;
  singleLine?: boolean; color?: string;
}
interface FormatoOriginal {
  file: string; width: number; height: number; fields: CampoFormato[];
}
const buffers = new Map<string, Buffer>();
// Carga el recurso de formato o fuente desde la salida compilada o las fuentes del proyecto y
// conserva su contenido en memoria.
function recurso(file: string): Buffer {
  const directorio = join(__dirname, 'assets', 'formatos');
  const ruta = existsSync(join(directorio, file)) ? join(directorio, file)
    : join(__dirname, '..', '..', 'src', 'documentacion-inicial', 'assets', 'formatos', file);
  if (!buffers.has(ruta)) buffers.set(ruta, readFileSync(ruta));
  return buffers.get(ruta);
}

// Resuelve el valor que se imprimirá en un campo, incluidos nombres con edad, ubicación
// completa y respuestas de los documentos.
function valorCampo(path: string, doc: any, plan: any, rubrica: any): string {
  const c = doc.caratula || {};
  if (path === 'personaConEdad') {
    if (!c.edad || /\b(años|edad)\b/i.test(c.nombre || '')) return c.nombre || '';
    return `${c.nombre || ''}, ${/^\d+$/.test(c.edad) ? `de ${c.edad} años de edad` : c.edad}`;
  }
  if (path === 'lugarCompleto') {
    let lugar = c.lugar || '';
    // Elimina diferencias de acentos y mayúsculas para detectar partes de la ubicación ya
    // incluidas en el texto.
    const normal = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    for (const parte of [c.municipio, c.departamento]) {
      if (parte && !normal(lugar).includes(normal(parte))) lugar += `${lugar ? ', ' : ''}${parte}`;
    }
    return lugar;
  }
  if (path.startsWith('protocolo.')) return rubrica.conoceProtocolo === path.split('.')[1] ? 'X' : '';
  const partes = path.split('.');
  if (partes[0] === 'plan' && partes.length === 3) {
    return plan.elementos.find((e: any) => e.codigo === partes[1])?.[partes[2]] || '';
  }
  if (partes[0] === 'rubrica' && partes.length === 3) {
    const item = rubrica.items.find((i: any) => i.codigo === partes[1]);
    if (partes[2] === 'SI' || partes[2] === 'NO') return item?.respuesta === partes[2] ? 'X' : '';
    return item?.observaciones || '';
  }
  const root = { ...doc, numeroDeic: doc.numeroDeic, investigadorNombre: doc.investigadorNombre, caratula: c, plan, rubrica };
  const value = partes.reduce((v, key) => v?.[key], root);
  return value == null ? '' : String(value);
}

// Dibuja los valores sobre las áreas editables del formato con sus fuentes y medidas,
// rechazando textos que exceden el espacio disponible.
async function sobreimpresion(formato: FormatoOriginal, doc: any, plan: any, rubrica: any): Promise<Buffer> {
  const printer = new PdfPrinter({ Arial: { normal: recurso('Arial.ttf'), bold: recurso('ArialBold.ttf') } });
  const pdf = printer.createPdfKitDocument({ pageSize: { width: formato.width, height: formato.height }, pageMargins: 0, content: [], defaultStyle: { font: 'Arial' } });
  for (const font of ['Arial', 'ArialBold', 'Calibri', 'CambriaBold']) pdf.registerFont(font, recurso(`${font}.ttf`));
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
  });
  // Prevalidar todos los espacios antes de escribir. No se cambia el tamaño
  // de letra, ni se cortan textos, ni se crean páginas adicionales.
  const textos = formato.fields.map(campo => ({ campo, texto: valorCampo(campo.path, doc, plan, rubrica).trim() }));
  for (const { campo, texto } of textos) {
    if (!texto) continue;
    pdf.font(campo.font).fontSize(campo.fontSize);
    const alto = campo.singleLine ? campo.fontSize : pdf.heightOfString(texto, { width: campo.width, lineGap: 0, paragraphGap: 0 });
    const ancho = campo.singleLine ? pdf.widthOfString(texto) : 0;
    if (alto > campo.height + 0.1 || ancho > campo.width + 0.1) {
      pdf.end();
      await result;
      throw new BadRequestException(`El texto de «${campo.label}» excede el espacio del formato original. Abrevia ese campo antes de imprimir; el diseño y la letra se conservan.`);
    }
  }
  for (const { campo, texto } of textos) {
    if (!texto) continue;
    pdf.font(campo.font).fontSize(campo.fontSize).fillColor(campo.color || '#000000');
    if (campo.singleLine) {
      const ancho = pdf.widthOfString(texto);
      const x = campo.x + (campo.align === 'center' ? (campo.width - ancho) / 2 : campo.align === 'right' ? campo.width - ancho : 0);
      pdf.text(texto, x, campo.y, { lineBreak: false });
    } else {
      pdf.text(texto, campo.x, campo.y, { width: campo.width, align: campo.align, lineGap: 0, paragraphGap: 0 });
    }
  }
  pdf.end();
  return result;
}

// Selecciona los formatos originales del caso y su modalidad, superpone los datos y reúne
// carátula, plan y rúbrica en un único PDF.
export async function generarDocumentacionPdf(doc: any, plan: any, rubrica: any): Promise<Buffer> {
  const manifest: Record<string, FormatoOriginal> = JSON.parse(recurso('manifest.json').toString('utf8'));
  const tipo = { Alerta: 'alerta', Maltrato: 'maltrato', Conflicto: 'conflicto' }[doc.tipoCaso];
  if (!tipo || (tipo === 'maltrato' && !['OFICIO', 'REQUERIMIENTO'].includes(doc.modalidadMaltrato))) throw new BadRequestException('Seleccione el formato del caso.');
  const claves = [`caratula-${tipo}`, `plan-${tipo}`, tipo === 'maltrato' ? `rubrica-maltrato-${doc.modalidadMaltrato.toLowerCase()}` : `rubrica-${tipo}`];
  const salida = await PDFDocument.create();
  for (const clave of claves) {
    const formato = manifest[clave];
    const original = await PDFDocument.load(recurso(formato.file));
    const [page] = await salida.copyPages(original, [0]);
    salida.addPage(page);
    const overlay = await PDFDocument.load(await sobreimpresion(formato, doc, plan, rubrica));
    if (overlay.getPageCount() !== 1) throw new BadRequestException('El contenido excede la página del formato original.');
    const [embedded] = await salida.embedPages([overlay.getPage(0)]);
    page.drawPage(embedded, { x: 0, y: 0, width: formato.width, height: formato.height });
  }
  return Buffer.from(await salida.save());
}
