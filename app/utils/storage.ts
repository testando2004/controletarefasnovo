export type Migration = (db: IDBDatabase, oldVersion: number, newVersion: number) => void;

interface OpenOptions {
  name?: string;
  version?: number;
  onMigrate?: Migration;
}

function openDB({ name = 'sistema-db', version = 1, onMigrate }: OpenOptions = {}): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldV = (event.oldVersion as number) || 0;
      const newV = version;
      // Default stores if not exist
      if (!db.objectStoreNames.contains('processos')) db.createObjectStore('processos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('empresas')) db.createObjectStore('empresas', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('templates')) db.createObjectStore('templates', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      if (onMigrate) onMigrate(db, oldV, newV);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet<T = unknown>(store: string, key: IDBValidKey, options?: OpenOptions): Promise<T | undefined> {
  const db = await openDB(options);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const st = tx.objectStore(store);
    const r = st.get(key);
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  });
}

export async function idbSet<T = unknown>(store: string, value: T, options?: OpenOptions): Promise<void> {
  const db = await openDB(options);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const st = tx.objectStore(store);
    const r = st.put(value as any);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

export async function idbDel(store: string, key: IDBValidKey, options?: OpenOptions): Promise<void> {
  const db = await openDB(options);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const st = tx.objectStore(store);
    const r = st.delete(key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

export async function idbGetAll<T = unknown>(store: string, options?: OpenOptions): Promise<T[]> {
  const db = await openDB(options);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const st = tx.objectStore(store);
    const r = st.getAll();
    r.onsuccess = () => resolve((r.result as T[]) || []);
    r.onerror = () => reject(r.error);
  });
}
