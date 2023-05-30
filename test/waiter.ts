function defer<T, E>() {
  const deferred: DeferredTmp<T, E> = {} as DeferredTmp<T, E>;
  deferred.promise = new Promise<T>((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred as Deferred<T, E>;
}

interface DeferredTmp<T, E> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: E) => void;
}

interface Deferred<T, E> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason: E) => void;
}

export function waiter<T>(delay = 5000) {
  const deferred = defer();
  const tid = setTimeout(() => {
    deferred.reject('timed out');
  }, delay);
  return [
    (r) => {
      clearTimeout(tid);
      deferred.resolve(r);
    },
    deferred.promise,
  ] as [(res: T) => void, Promise<T>];
}
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function wait_for<T>(
  cb: () => Promise<T>,
  ms = 2500.0
): Promise<T> {
  let ret;
  let last_error: unknown = '';
  try {
    ret = await cb();
  } catch (e) {
    last_error = e;
  }
  const to = Date.now() + ms;
  while (!ret) {
    if (Date.now() > to) throw Error(`timed out ${last_error}`);
    await sleep(100);
    try {
      ret = await cb();
    } catch (e) {
      last_error = e;
    }
  }
  return ret;
}
