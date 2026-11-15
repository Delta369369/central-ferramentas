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

const boButton = document.getElementById("selectBo");
boButton.addEventListener("click", () => {
  location.href = "./ferramentas/organizador-bo/";
});
