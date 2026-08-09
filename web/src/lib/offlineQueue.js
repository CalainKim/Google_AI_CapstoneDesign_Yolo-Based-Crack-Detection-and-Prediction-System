// 오프라인 촬영 대기열
//
// 현장은 통신이 불안정하다. 오프라인일 때 촬영한 사진을 브라우저(IndexedDB)에 저장했다가
// 연결이 회복되면 자동으로 서버에 전송한다.
import { uploadInspection } from "../api";

const DB_NAME = "ansim-offline";
const STORE = "queue";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function enqueue({ file, facilityId, part }) {
  const db = await openDB();
  const buf = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const req = tx(db, "readwrite").add({
      blob: new Blob([buf], { type: file.type || "image/jpeg" }),
      name: file.name || "capture.jpg",
      facilityId: facilityId || null,
      part: part || "미지정",
      at: new Date().toISOString(),
    });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = tx(db, "readonly").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function remove(id) {
  const db = await openDB();
  return new Promise((resolve) => {
    const req = tx(db, "readwrite").delete(id);
    req.onsuccess = resolve;
    req.onerror = resolve;
  });
}

/** 대기열을 순서대로 전송. 반환: 전송 성공 건수 */
export async function flushQueue() {
  if (!navigator.onLine) return 0;
  const items = await listQueue();
  let sent = 0;
  for (const it of items) {
    try {
      const file = new File([it.blob], it.name, { type: it.blob.type });
      await uploadInspection(file, it.facilityId, it.part);
      await remove(it.id);
      sent += 1;
    } catch {
      break; // 서버가 아직 불안정하면 중단하고 다음 기회에
    }
  }
  return sent;
}
