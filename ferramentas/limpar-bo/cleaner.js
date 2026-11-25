(function(global){'use strict';
const uuid=/\(([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\)\s*Tj/gi;
const block=/BT\s+[-+\d.]+\s+[-+\d.]+\s+[-+\d.]+\s+[-+\d.]+\s+[-+\d.]+\s+[-+\d.]+\s+Tm\s+\([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\)\s+Tj\s+ET/gi;
let loading;
function ensureLib(){
 if(global.PDFLib)return Promise.resolve(global.PDFLib);
 if(!loading)loading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
  script.onload=()=>global.PDFLib?resolve(global.PDFLib):reject(Error('Biblioteca PDF indisponível.'));
  script.onerror=()=>reject(Error('Não foi possível carregar a biblioteca de PDF. Verifique a conexão.'));
  document.head.appendChild(script);
 }).catch(e=>{loading=null;throw e});
 return loading;
}
async function streamText(raw,PDFLib){
 let filter=raw.dict.get(PDFLib.PDFName.of('Filter'));
 if(filter&&String(filter)!=='/FlateDecode')return null;
 let bytes=raw.contents;
 if(filter){
  if(!global.DecompressionStream)throw Error('Navegador sem suporte à descompactação.');
  bytes=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
 }
 return new TextDecoder('latin1').decode(bytes);
}
function marked(text){
 if(!text||text.length<350)return 0;
 const ids=[...text.matchAll(uuid)].map(x=>x[1].toLowerCase());
 if(ids.length<8||new Set(ids).size!==1)return 0;
 const parts=[...text.matchAll(block)];
 if(parts.length!==ids.length)return 0;
 const others=text.replace(block,'').replace(/^\s*Q\s*\/gs\d+\s+gs\s+\/F\d+\s+[\d.]+\s+Tf\s*/,'').trim();
 return others===''?ids.length:0;
}
async function clean(file){
 const PDFLib=await ensureLib();
 if(file.size>75*1024*1024)throw Error('O arquivo supera 75 MB.');
 const doc=await PDFLib.PDFDocument.load(await file.arrayBuffer(),{updateMetadata:false});
 let pages=0,occurrences=0;
 for(const page of doc.getPages()){
  const item=page.node.get(PDFLib.PDFName.of('Contents'));
  const content=item&&doc.context.lookup(item);
  if(!content)continue;
  const entries=content instanceof PDFLib.PDFArray?Array.from({length:content.size()},(_,i)=>i):[-1];
  let did=false;
  for(const index of entries){
   const candidate=doc.context.lookup(index<0?item:content.get(index));
   if(!(candidate instanceof PDFLib.PDFRawStream))continue;
   const n=marked(await streamText(candidate,PDFLib));
   if(!n)continue;
   const replacement=doc.context.register(doc.context.flateStream('Q\n'));
   if(index<0)page.node.set(PDFLib.PDFName.of('Contents'),replacement);
   else content.set(index,replacement);
   did=true;occurrences+=n;
  }
  if(did)pages++;
 }
 if(!occurrences)throw Error('Marca diagonal independente não reconhecida. O PDF não foi modificado.');
 const output=await doc.save({useObjectStreams:false,updateFieldAppearances:false});
 if((await PDFLib.PDFDocument.load(output)).getPageCount()!==doc.getPageCount())throw Error('Falha na verificação do resultado.');
 return {output,pages,occurrences};
}
function download(file,result){
 const url=URL.createObjectURL(new Blob([result.output],{type:'application/pdf'}));
 const anchor=document.createElement('a');anchor.href=url;
 anchor.download=file.name.replace(/\.pdf$/i,'')+'_LIMPO.pdf';
 document.body.appendChild(anchor);anchor.click();anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
global.DeltaBoCleaner={clean,download,ensureLib};
})(window);