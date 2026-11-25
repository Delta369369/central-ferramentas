/* LIMPAR B.O. v2 — remoção conservadora de fluxo de marca d'água no próprio navegador.
 Mantém todos os bytes do original e acrescenta uma revisão PDF com páginas sem o fluxo final.
 Reconhece somente o formato conhecido de B.O. com 5 fluxos e UUID diagonal repetido. */
(function(global){
'use strict';
const uuidRE=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const pdfjsURL='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const workerURL='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
let loader;
function ensurePDFJS(){
 if(global.pdfjsLib)return Promise.resolve(global.pdfjsLib);
 if(!loader)loader=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=pdfjsURL;
  script.onload=()=>global.pdfjsLib?resolve(global.pdfjsLib):reject(Error('Leitor PDF indisponível.'));
  script.onerror=()=>reject(Error('Falha ao carregar leitor PDF. Verifique a conexão.'));
  document.head.appendChild(script);
 }).catch(e=>{loader=null;throw e});
 return loader;
}
function toLatin1(bytes){
 let text='';
 for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));
 return text;
}
function toAscii(text){
 const out=new Uint8Array(text.length);
 for(let i=0;i<text.length;i++){
  const value=text.charCodeAt(i);
  if(value>127)throw Error('Objeto PDF contém caracteres não suportados.');
  out[i]=value;
 }
 return out;
}
function scan(bytes){
 const source=toLatin1(bytes);
 if(!source.startsWith('%PDF-'))throw Error('Cabeçalho PDF inválido.');
 if(/\/Type\s*\/Sig\b|\/ByteRange\s*\[/.test(source))throw Error('Arquivo assinado digitalmente: limpeza suspensa para preservar a assinatura.');
 const starts=[...source.matchAll(/\bstartxref\s+(\d+)\s+%%EOF/g)];
 if(starts.length!==1)throw Error('O formato de revisão do PDF não é suportado.');
 const prev=Number(starts[0][1]);
 if(!Number.isSafeInteger(prev)||prev<0||prev>=bytes.length||source.slice(prev,prev+4)!=='xref')
  throw Error('Tabela de referências PDF não reconhecida.');
 const trailerMatch=/\btrailer\s*(<<[\s\S]*?>>)\s*startxref\s+\d+\s+%%EOF/.exec(source.slice(prev));
 if(!trailerMatch)throw Error('Metadados estruturais do PDF não reconhecidos.');
 const trailer=trailerMatch[1],sizeMatch=/\/Size\s+(\d+)/.exec(trailer);
 if(/\/Prev\b|\/XRefStm\b/.test(trailer)||!sizeMatch||!/\/Root\s+\d+\s+\d+\s+R\b/.test(trailer))
  throw Error('Arquivo PDF com organização não suportada.');
 const oldSize=Number(sizeMatch[1]);
 const pages=[],streams=new Map();
 const objectRE=/(?:^|[\r\n])(\d+)\s+(\d+)\s+obj\s*/gm;
 for(const match of source.matchAll(objectRE)){
  const number=Number(match[1]),generation=Number(match[2]);
  if(!Number.isInteger(number)||number>=oldSize)continue;
  const begin=match.index+match[0].length,end=source.indexOf('endobj',begin);
  if(end<0)throw Error('Objeto PDF incompleto.');
  const body=source.slice(begin,end);
  if(/\/Type\s*\/Page\b/.test(body)&&!body.includes('stream')){
   const cm=/\/Contents\s*\[([^\]]+)\]/.exec(body);
   if(!cm)throw Error('Página com estrutura de conteúdo não compatível.');
   const refs=cm[1].trim().match(/\d+\s+\d+\s+R/g)||[];
   if(refs.length!==5||refs.join(' ').replace(/\s+/g,' ')!==cm[1].trim().replace(/\s+/g,' '))
    throw Error('O boletim tem uma estrutura diferente do modelo reconhecido.');
   const last=/^(\d+)\s+(\d+)\s+R$/.exec(refs[4]);
   if(!last)throw Error('Fluxo final da página inválido.');
   const edited=body.replace(cm[0],'/Contents ['+refs.slice(0,4).join(' ')+']');
   if(!/^[\x09\x0a\x0d\x20-\x7e]*$/.test(edited))
    throw Error('Objeto de página contém dados não suportados.');
   pages.push({object:number,generation,edited,last:Number(last[1])});
  }
  const header=/^\s*<<[\s\S]*?>>\s*stream(?:\r\n|\n|\r)/.exec(body);
  if(header){
   const length=/\/Length\s+(\d+)/.exec(header[0]);
   streams.set(number,{length:length?Number(length[1]):0,flate:/\/Filter\s*\/FlateDecode\b/.test(header[0])});
  }
 }
 if(!pages.length||pages.length>200||new Set(pages.map(p=>p.object)).size!==pages.length)
  throw Error('Não foram encontradas páginas compatíveis.');
 const lastStreams=pages.map(p=>streams.get(p.last));
 if(lastStreams.some(x=>!x||!x.flate||x.length<100||x.length>25000)
    ||new Set(lastStreams.map(x=>x.length)).size!==1
    ||new Set(pages.map(p=>p.last)).size!==pages.length)
  throw Error('Não foi possível isolar a camada diagonal com segurança.');
 return {bytes,pages,prev,trailer,oldSize};
}
async function verifyWatermark(bytes,pageCount,onProgress){
 const pdfjs=await ensurePDFJS();pdfjs.GlobalWorkerOptions.workerSrc=workerURL;
 let task,doc;
 try{
  task=pdfjs.getDocument({data:bytes.slice()});doc=await task.promise;
  if(doc.numPages!==pageCount)throw Error('Número de páginas inconsistente.');
  let uuid='',count=0;
  for(let i=1;i<=doc.numPages;i++){
   const page=await doc.getPage(i);
   const text=await page.getTextContent({disableCombineTextItems:true});
   const marks=text.items.filter(x=>uuidRE.test((x.str||'').trim()));
   if(marks.length<8)throw Error('Marca diagonal não encontrada na página '+i+'.');
   for(const mark of marks){
    const value=mark.str.trim().toLowerCase();
    if(uuid&&uuid!==value)throw Error('Há identificadores diferentes na mesma página ou entre páginas.');
    uuid=value;
    const t=mark.transform;
    if(!t||t.length<4)throw Error('Inclinação da marca não identificada.');
    const angle=Math.abs(Math.atan2(t[1],t[0])*180/Math.PI);
    if(Math.min(Math.abs(angle-60),Math.abs(angle-120))>10)throw Error('Marca não corresponde à inclinação esperada.');
   }
   count+=marks.length;
   page.cleanup();
   if(onProgress)onProgress('Marca encontrada na página '+i+' de '+pageCount+'.');
  }
  return {uuid,count};
 }catch(e){
  if(e?.name==='PasswordException')throw Error('O documento exige senha de abertura. Não é possível processar sem a senha.');
  throw e;
 }finally{
  if(doc)await doc.destroy().catch(()=>{});
  else if(task)await task.destroy().catch(()=>{});
 }
}
function appendPDF(parsed){
 const {bytes,pages,prev,trailer,oldSize}=parsed,ordered=[...pages].sort((a,b)=>a.object-b.object);
 let added='\n',entries=[];
 for(const p of ordered){
  entries.push({number:p.object,generation:p.generation,offset:bytes.length+added.length});
  added+=p.object+' '+p.generation+' obj\n'+p.edited.trim()+'\nendobj\n';
 }
 const offset=bytes.length+added.length;
 added+='xref\n';
 for(let i=0;i<entries.length;){
  let j=i+1;while(j<entries.length&&entries[j].number===entries[j-1].number+1)j++;
  added+=entries[i].number+' '+(j-i)+'\n';
  for(let k=i;k<j;k++){
   if(entries[k].offset>9999999999)throw Error('PDF maior que o suportado.');
   added+=String(entries[k].offset).padStart(10,'0')+' '+String(entries[k].generation).padStart(5,'0')+' n \n';
  }
  i=j;
 }
 const updatedTrailer=trailer.replace(/\/Size\s+\d+/,'/Size '+oldSize).replace(/>>\s*$/,'/Prev '+prev+'\n>>');
 added+='trailer\n'+updatedTrailer+'\nstartxref\n'+offset+'\n%%EOF\n';
 const suffix=toAscii(added),output=new Uint8Array(bytes.length+suffix.length);
 output.set(bytes);output.set(suffix,bytes.length);
 return output;
}
async function clean(file,onProgress){
 if(!file||!file.size)throw Error('Selecione um arquivo PDF.');
 if(file.size>75*1024*1024)throw Error('O tamanho máximo permitido é de 75 MB.');
 if(onProgress)onProgress('Lendo estrutura do boletim...');
 const parsed=scan(new Uint8Array(await file.arrayBuffer()));
 if(onProgress)onProgress('Identificando camada diagonal...');
 const mark=await verifyWatermark(parsed.bytes,parsed.pages.length,onProgress);
 const output=appendPDF(parsed);
 if(onProgress)onProgress('Verificando documento limpo...');
 const pdfjs=await ensurePDFJS();
 let doc,task;
 try{
  task=pdfjs.getDocument({data:output.slice()});doc=await task.promise;
  if(doc.numPages!==parsed.pages.length)throw Error('Falha de integridade: quantidade de páginas alterada.');
  for(let i=1;i<=doc.numPages;i++){
   const p=await doc.getPage(i),txt=await p.getTextContent();
   if(txt.items.some(x=>(x.str||'').toLowerCase().includes(mark.uuid)))
    throw Error('A marca permaneceu na página '+i+'.');
   if(!txt.items.some(x=>(x.str||'').trim().length>=4))
    throw Error('Não foi encontrado texto original na página '+i+'.');
   p.cleanup();
  }
 }finally{
  if(doc)await doc.destroy().catch(()=>{});
  else if(task)await task.destroy().catch(()=>{});
 }
 return {output,pages:parsed.pages.length,occurrences:mark.count,identifier:mark.uuid};
}
function download(file,result){
 const url=URL.createObjectURL(new Blob([result.output],{type:'application/pdf'}));
 const a=document.createElement('a');a.href=url;
 a.download=file.name.replace(/\.pdf$/i,'')+'_LIMPO.pdf';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
global.DeltaBoCleaner={clean,download,ensurePDFJS,version:'2.0.0'};
})(window);
