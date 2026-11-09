/**
 * Coalesce inventory changes while a snapshot request is in flight. The next
 * request always reads the latest inventory, so a removal cannot be lost
 * behind an older, slower snapshot.
 */
export function createCoalescedReporter(getSnapshot, sendSnapshot, onError = () => {}) {
  let reporting = false;
  let pending = false;

  return function reportLatest() {
    pending = true;
    if (reporting) return Promise.resolve();

    reporting = true;
    return (async () => {
      try {
        while (pending) {
          pending = false;
          try {
            await sendSnapshot(getSnapshot());
          } catch (error) {
            onError(error);
          }
        }
      } finally {
        reporting = false;
        if (pending) void reportLatest();
      }
    })();
  };
}
