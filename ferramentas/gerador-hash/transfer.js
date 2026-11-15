/* Transferência local de arquivos entre a Central e a ferramenta. */
window.HashTransfer = {
 async open() {
  return new Promise((resolve,reject)=>{
   const request=indexedDB.open("delta-hash-transfer",1);
   request.onupgradeneeded=()=>request.result.createObjectStore("batches");
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
 },
 async send(files,category) {
  const contents = [];
  for (const file of files) {
   contents.push({
    bytes: await file.arrayBuffer(),
    name: file.name,
    type: file.type,
    lastModified: file.lastModified
   });
  }
  const db=await this.open();
  const token=crypto.randomUUID();
  try {
   await new Promise((resolve,reject)=>{
    const tx=db.transaction("batches","readwrite");
    tx.objectStore("batches").put({files:contents,category,created:Date.now()},token);
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
   });
   return token;
  } finally {db.close()}
 },
 async receive() {
  const token = new URLSearchParams(location.search).get("selection");
  if (!token) return null;
  const db = await this.open();
  try {
   const batch = await new Promise((resolve, reject) => {
    const tx = db.transaction("batches", "readonly");
    const request = tx.objectStore("batches").get(token);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onabort = () => reject(tx.error);
   });
   if (!batch) return null;
   // Materializa os dados antes de remover a cópia temporária do navegador.
   const files = [];
   for (const file of batch.files) {
    const bytes = file.bytes || await file.arrayBuffer();
    files.push(new File([bytes], file.name, {
     type: file.type,
     lastModified: file.lastModified
    }));
   }
   await new Promise((resolve, reject) => {
    const tx = db.transaction("batches", "readwrite");
    tx.objectStore("batches").delete(token);
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
   });
   history.replaceState(null, "", location.pathname);
   return { ...batch, files };
  } finally {
   db.close();
  }
 }
};
