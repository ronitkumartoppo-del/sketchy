const DB_NAME = "sketchy";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  try {
    const value = await requestToPromise(db.transaction("kv", "readonly").objectStore("kv").get(key));
    return value as T | undefined;
  } finally {
    db.close();
  }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(value, key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function idbGetBlob(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  try {
    const value = await requestToPromise(db.transaction("blobs", "readonly").objectStore("blobs").get(id));
    return value instanceof Blob ? value : undefined;
  } finally {
    db.close();
  }
}

export async function idbPutBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction("blobs", "readwrite");
    tx.objectStore("blobs").put(blob, id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function idbListBlobIds(): Promise<string[]> {
  const db = await openDb();
  try {
    const keys = await requestToPromise(db.transaction("blobs", "readonly").objectStore("blobs").getAllKeys());
    return keys.map((key) => String(key));
  } finally {
    db.close();
  }
}

export async function idbDeleteBlobs(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDb();
  try {
    const tx = db.transaction("blobs", "readwrite");
    const store = tx.objectStore("blobs");
    for (const id of ids) store.delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
