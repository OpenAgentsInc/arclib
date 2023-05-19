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
  return [(r) => { clearTimeout(tid); deferred.resolve(r); }, deferred.promise] as [
    (res: any) => any,
    Promise<any>
  ];
}
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
