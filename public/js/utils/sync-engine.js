import { flushSyncQueue, getPendingCount, dispatchSyncStatus } from './offline-store.js';

let _flushing = false;

export async function syncNow() {
  if (_flushing || !navigator.onLine) return;

  // Short-circuit before acquiring the lock so an empty queue never blocks
  const before = await getPendingCount();
  if (!before) return;

  _flushing = true;
  try {
    dispatchSyncStatus(before);
    const { synced, failed } = await flushSyncQueue();
    dispatchSyncStatus(await getPendingCount());

    if (failed) console.warn(`[Sync] ${failed} item(s) failed — will retry next online event`);
    if (synced) console.info(`[Sync] ${synced} item(s) synced`);
  } finally {
    _flushing = false;
  }
}

export function startSyncEngine() {
  window.addEventListener('online', async () => {
    document.dispatchEvent(new CustomEvent('fufu:online'));
    await syncNow();
  });

  window.addEventListener('offline', () => {
    document.dispatchEvent(new CustomEvent('fufu:offline'));
  });

  // Background Sync (Chrome/Android — fires even when tab is in background)
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then(reg => reg.sync.register('fufu-sync'))
      .catch(() => {});
  }

  // SW tells us a background sync fired → flush queue
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'fufu-sync') syncNow();
    });
  }

  getPendingCount().then(dispatchSyncStatus);
}
