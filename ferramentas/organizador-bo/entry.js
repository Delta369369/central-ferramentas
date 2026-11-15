/* Transferência local de arquivos entre a Central e a ferramenta. */
window.BoTransfer = {
 async open() {
  return new Promise((resolve,reject)=>{
   const request=indexedDB.open("delta-bo-transfer",1);
   request.onupgradeneeded=()=>request.result.createObjectStore("batches");
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
 },
 async send(files,category) {
  const db=await this.open();
  const token=crypto.randomUUID();
  try {
   await new Promise((resolve,reject)=>{
    const tx=db.transaction("batches","readwrite");
    tx.objectStore("batches").put({files:[...files],category,created:Date.now()},token);
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
   });
   return token;
  } finally {db.close()}
 },
 async receive() {
  const token=new URLSearchParams(location.search).get("selection");
  if(!token)return null;
  const db=await this.open();
  try {
   return await new Promise((resolve,reject)=>{
    const tx=db.transaction("batches","readwrite"),store=tx.objectStore("batches");
    const request=store.get(token);let batch=null;
    request.onsuccess=()=>{batch=request.result;store.delete(token)};
    tx.oncomplete=()=>{history.replaceState(null,"",location.pathname);resolve(batch)};
    tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
   });
  } finally {db.close()}
 }
};

const boButton=document.getElementById("selectBo");
const boPicker=document.createElement("input");
boPicker.type="file";
boPicker.accept=".pdf,.txt,.text,.docx,.html,.htm,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
boPicker.hidden=true;
document.body.append(boPicker);
const boStatus=document.createElement("p");
boStatus.setAttribute("role","status");
boStatus.style.fontSize="14px";
boButton.after(boStatus);
boButton.addEventListener("click",()=>{
 boPicker.value="";
 boPicker.click();
});
boPicker.addEventListener("change",async()=>{
 if(!boPicker.files.length)return;
 boButton.disabled=true;
 boStatus.textContent="Abrindo o Organizador de BO…";
 try{
  const token=await BoTransfer.send([boPicker.files[0]],"bo");
  location.href="./ferramentas/organizador-bo/?selection="+encodeURIComponent(token);
 }catch{
  boStatus.textContent="Não foi possível transferir o arquivo. Abra o Organizador pelo link abaixo e anexe o documento.";
  boButton.disabled=false;
 }
});
window.addEventListener("pageshow",()=>{boButton.disabled=false;boStatus.textContent=""});
