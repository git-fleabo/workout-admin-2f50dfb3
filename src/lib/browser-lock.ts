// Web Locks serialize work across tabs. The caller also handles browsers without
// Web Locks; workout writes remain protected by their database operation ID.
export async function withBrowserLock<T>(name: string, work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return await navigator.locks.request(name, work);
  }
  return work();
}
