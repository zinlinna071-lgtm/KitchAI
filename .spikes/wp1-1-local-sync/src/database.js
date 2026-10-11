const databaseName = "kitchai-wp1-1-local-sync";
const databaseVersion = 1;
let databasePromise;

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, databaseVersion);
      request.onupgradeneeded = () => {
        const database = request.result;
        database.createObjectStore("profiles", { keyPath: "id" });
        database.createObjectStore("outbox", { keyPath: "operationId" });
        database.createObjectStore("conflicts", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return databasePromise;
}

async function transact(storeNames, mode, work) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeNames, mode);
    let result;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Transaction aborted"));
    try {
      result = work(transaction);
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function getRecord(storeName, key) {
  return transact([storeName], "readonly", (transaction) =>
    requestResult(transaction.objectStore(storeName).get(key)),
  );
}

export function getRecords(storeName) {
  return transact([storeName], "readonly", (transaction) =>
    requestResult(transaction.objectStore(storeName).getAll()),
  );
}

export function writeRecords(storeNames, write) {
  return transact(storeNames, "readwrite", write);
}

export async function clearDatabase() {
  await transact(["profiles", "outbox", "conflicts"], "readwrite", (transaction) => {
    transaction.objectStore("profiles").clear();
    transaction.objectStore("outbox").clear();
    transaction.objectStore("conflicts").clear();
  });
}
