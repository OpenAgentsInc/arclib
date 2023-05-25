function defer() {
  const deferred: any = {};
  deferred.promise = new Promise<any>((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
}
export function waiter(delay = 5000) {
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
  ] as [(res: any) => any, Promise<any>];
}
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function wait_for(
  cb: () => Promise<any>,
  ms = 2500.0
): Promise<any> {
  let ret;
  let last_error: any = '';
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
