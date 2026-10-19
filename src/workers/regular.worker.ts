/// <reference lib="webworker" />
import { executeRegular, type RegularRequest } from '../core/regular/requests';
import { toOpError } from '../core/regular/api';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (ev: MessageEvent<RegularRequest>) => {
  try {
    ctx.postMessage({ ok: true, result: executeRegular(ev.data) });
  } catch (e) {
    ctx.postMessage({ ok: false, error: toOpError(e) });
  }
};
