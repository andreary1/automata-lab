import { runBatch, type BatchCase, type BatchResult } from './fa/batch';
import type { Machine } from './machine';
import { runBatchPDA } from './pda/batch';
import { runBatchTM } from './tm/batch';
import type { ProjectSettings } from './persistence/schema';

/** Teste em lote para qualquer modelo. */
export function runMachineBatch(m: Machine, cases: BatchCase[], settings: ProjectSettings, onProgress?: (d: number, t: number) => void): BatchResult[] {
  if (m.kind === 'pda') return runBatchPDA(m, cases, { maxSteps: settings.maxSteps, maxConfigs: settings.maxConfigs, maxStack: settings.maxStack, onProgress });
  if (m.kind === 'tm') return runBatchTM(m, cases, { maxSteps: settings.maxSteps, onProgress });
  return runBatch(m, cases, { maxSteps: settings.maxSteps, onProgress });
}
