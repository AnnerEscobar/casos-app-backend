"""Prepara bases vectoriales sin datos de ejemplo. No modifica los originales.

Uso: Python con pdfplumber/PyMuPDF; --inventario y --geometria proceden de
la auditoría local de los originales y de su exportación de solo lectura en Word.
No se ejecuta en producción: el servidor solo necesita los PDF resultantes.
"""
from pathlib import Path
import argparse,json,hashlib,sys,shutil

parser=argparse.ArgumentParser()
parser.add_argument('--auditoria',type=Path,required=True)
parser.add_argument('--salida',type=Path,default=Path('src/documentacion-inicial/assets/formatos'))
args=parser.parse_args()
sys.path.insert(0,str(args.auditoria/'python-libs'))
import pymupdf

inventory=json.loads((args.auditoria/'inventario.json').read_text(encoding='utf8'))
geometry=json.loads((args.auditoria/'geometria.json').read_text(encoding='utf8'))
codes=json.loads((args.auditoria/'codigos.json').read_text(encoding='utf8'))
args.salida.mkdir(parents=True,exist_ok=True)
manifest={}
def sha(data): return hashlib.sha256(data).hexdigest()
def slot(path,rect,size=11,font='Arial',align='left',label=None,padding=2,**kw):
 x0,y0,x1,y1=rect
 labels={'numeroDeic':'Número DEIC','caratula.numeroMp':'Número MP','caratula.numeroAlerta':'Número de alerta','personaConEdad':'Nombre y edad','lugarCompleto':'Lugar del hecho','investigadorNombre':'Investigador asignado','caratula.nombre':'Víctima','caratula.observaciones':'Observaciones de la carátula','plan.observaciones':'Observaciones del plan','plan.mandoNombre':'Nombre del mando','rubrica.dependenciaSupervisada':'Dependencia supervisada','rubrica.supervisorNombre':'Nombre del supervisor'}
 return dict(path=path,x=x0+padding,y=y0+padding,width=x1-x0-2*padding,height=y1-y0-2*padding,fontSize=size,font=font,align=align,label=label or labels.get(path,path),**kw)
caratulas={
 'caratula-alerta':[
  slot('numeroDeic',[58,183,554,237],44,'ArialBold','center',padding=0,singleLine=True),
  slot('caratula.numeroMp',[389,237.2,549,255.9],16,align='center',padding=0,singleLine=True),
  slot('caratula.numeroAlerta',[389,256.1,549,274.8],16,align='center',padding=0,singleLine=True),
  slot('personaConEdad',[85,389,535,467],16,align='center',padding=0),
  slot('lugarCompleto',[65,523,548,610],16,align='center',padding=0),
  slot('investigadorNombre',[308,745.5,527,781],16,padding=0),
  slot('caratula.observaciones',[308,784,527,819],16,padding=0)],
 'caratula-conflicto':[
  slot('numeroDeic',[42,197,567,250],44,'ArialBold','center',padding=0,singleLine=True),
  slot('caratula.numeroMp',[286,251,566,268],12,align='center',padding=0,singleLine=True),
  slot('lugarCompleto',[286,268.5,566,296.4],12,padding=0),
  slot('personaConEdad',[66,413,550,501],14,align='center',padding=0),
  slot('investigadorNombre',[290,634,566,668],16,padding=0),
  slot('caratula.observaciones',[290,671,566,705],16,padding=0)],
 'caratula-maltrato':[
  slot('numeroDeic',[51,212.5,571,303],45,'CambriaBold','center',padding=0,singleLine=True),
  slot('caratula.numeroMp',[299,303,569,336],14,'ArialBold',padding=0),
  slot('investigadorNombre',[299,337,569,360],14,'CambriaBold',padding=0),
  slot('lugarCompleto',[65,429,569,530],14,align='center',padding=0),
  slot('caratula.nombre',[274,709.8,549,737],12,'ArialBold',padding=0),
  slot('caratula.observaciones',[274,738,549,761],14,'CambriaBold',padding=0)]
}
for key,src in inventory.items():
 original=Path(src['path'])
 if sha(original.read_bytes())!=src['sha256']: raise RuntimeError('El original cambió: '+key)
 evidence=geometry[key]; page=evidence['pages'][0]
 document=pymupdf.open(evidence['pdf']); pdfpage=document[0]
 assert len(document)==1,'Revisar todas las páginas antes de preparar '+key
 # Las marcas X y nombres de supervisión en los ejemplos son anotaciones.
 # Se eliminan sus objetos y apariencias, no se tapan con rectángulos blancos.
 for annot in list(pdfpage.annots() or []): pdfpage.delete_annot(annot)
 for link in pdfpage.get_links(): pdfpage.delete_link(link)
 redactions=[]; fields=[]
 if key.startswith('caratula'):
  fields=caratulas[key]
  # Eliminar texto solamente; dejar intactos emblemas, marcas de agua y líneas.
  redactions=[[f['x'],f['y'],f['x']+f['width'],f['y']+f['height']] for f in fields]
  # La caja de escritura puede empezar antes del ascendente del texto. La
  # redacción solo toca los datos impresos, nunca el rótulo inmediatamente arriba.
  if key=='caratula-alerta': redactions[4][1]=525
  if key=='caratula-conflicto': redactions[3][1]=415
  if key=='caratula-maltrato':
   redactions[0][1]=222
   redactions[3][1]=431
 elif key.startswith('plan'):
  rows=page['tables'][0]['rows']; items=codes[key]
  assert len(rows)==len(items)+3
  for i,item in enumerate(items):
   cells=[c for c in rows[i+1] if c is not None]
   assert len(cells)==4
   for j,prop in enumerate(['informacionObtenida','informacionNecesitaObtener','diligenciasRealizar']):
    rect=cells[j+1]; size=11.04 if key=='plan-conflicto' else 10
    nombres=['Información obtenida','Información pendiente','Diligencias a realizar']
    fields.append(slot('plan.'+item['codigo']+'.'+prop,rect,size,padding=4,label='Plan: '+item['descripcion']+' - '+nombres[j]))
    redactions.append([rect[0]+1,rect[1]+1,rect[2]-1,rect[3]-1])
  for index,path in [(-2,'plan.observaciones'),(-1,'plan.mandoNombre')]:
   rect=[c for c in rows[index] if c is not None][-1]
   campo=slot(path,rect,11.04 if key=='plan-conflicto' else 10,padding=4)
   if key=='plan-conflicto' and path=='plan.observaciones':
    campo['y']-=2;campo['height']+=4
   fields.append(campo)
   redactions.append([rect[0]+1,rect[1]+1,rect[2]-1,rect[3]-1])
  word=next(w for w in page['words'] if w['text'].startswith('DEIC') or w['text'].startswith('___'))
  rect=[word['x0'],word['top']-3,word['x1'],word['bottom']+2]
  fields.append(slot('numeroDeic',rect,word['size'],'ArialBold',padding=0,singleLine=True,color='#0070C0' if key=='plan-conflicto' else '#000000'))
  if key=='plan-conflicto': redactions.append([word['x0']-1,word['top']-1,word['x1']+1,word['bottom']+1])
 else:
  table=page['tables'][-1]; rows=table['rows']; items=codes[key]
  assert len(rows)-2==len(items),(key,len(rows),len(items))
  question=[c for c in rows[0] if c is not None]
  assert len(question)==2
  for j,v in enumerate(['SI','NO']): fields.append(slot('protocolo.'+v,question[j],11,'Calibri','center',padding=1.5,singleLine=True))
  for i,item in enumerate(items):
   cells=[c for c in rows[i+2] if c is not None]
   assert len(cells)==4
   if item['tipo']=='ITEM':
    for j,v in enumerate(['SI','NO']): fields.append(slot('rubrica.'+item['codigo']+'.'+v,cells[j+1],11,'Calibri','center',padding=1.5,singleLine=True))
    campo=slot('rubrica.'+item['codigo']+'.observaciones',cells[3],11,'Calibri',padding=2,label='Observaciones de rúbrica: '+item['descripcion'])
    campo['y']=cells[3][1];campo['height']=cells[3][3]-cells[3][1]
    fields.append(campo)
  lines=[w for w in page['words'] if w['top']>630 and w['text'].startswith('___')]
  assert len(lines)==3
  for word,path in zip(lines[:2],['rubrica.dependenciaSupervisada','rubrica.supervisorNombre']):
   fields.append(slot(path,[word['x0'],word['top']-4,word['x1'],word['bottom']],word['size'],'Calibri',padding=0,singleLine=True))
 for rect in redactions: pdfpage.add_redact_annot(pymupdf.Rect(rect),fill=False,cross_out=False)
 if redactions: pdfpage.apply_redactions(images=0,graphics=0,text=0)
 document.set_metadata({}); document.del_xml_metadata()
 document.set_toc([])
 for name in document.embfile_names(): document.embfile_del(name)
 target=args.salida/(key+'.pdf')
 document.save(target,garbage=4,deflate=True,clean=True)
 document.close()
 # Nunca guardar las referencias llenas ni la geometría que contiene nombres.
 manifest[key]={'file':target.name,'sourceSha256':src['sha256'],'sha256':sha(target.read_bytes()),
   'width':page['width'],'height':page['height'],'fields':fields}
 evidence['editableAreas']=redactions
for name,file in [('Arial','arial.ttf'),('ArialBold','arialbd.ttf'),('CambriaBold','cambriab.ttf'),('Calibri','calibri.ttf')]:
 shutil.copyfile(Path('C:/Windows/Fonts')/file,args.salida/(name+'.ttf'))
(args.salida/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
(args.auditoria/'geometria.json').write_text(json.dumps(geometry,ensure_ascii=False,indent=2),encoding='utf8')
# Contrato local de fidelidad; contiene inventario y mapa de campos, no cambia fuentes.
(args.auditoria/'artifact.md').write_text('# Contrato de formatos\n\nLos diez originales son la autoridad visual.\nCada referencia tiene una página. Se conservan dimensiones, fuentes, imágenes,\ncolores, tablas, líneas, pies y posiciones. Solo las áreas de datos son editables.\nNo se añaden páginas, firmas, títulos ni numeración. No se reduce la fuente\nautomáticamente: un desbordamiento se rechaza con mensaje del campo.\n\n'+
 '\n'.join(f'- {k}: SHA256 original {v["sourceSha256"]}; tamaño {v["width"]} x {v["height"]} pt; {len(v["fields"])} campos. Mapa: assets/formatos/manifest.json.' for k,v in manifest.items())+'\n',encoding='utf8')
print('Preparados',len(manifest),'formatos sin alterar los originales.')
