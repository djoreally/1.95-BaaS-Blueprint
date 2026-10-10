import type { ZeroChangeClass, ZeroGateResult } from './index.js';
import { requiredTestPlanes } from './index.js';

export type ZeroTestPlane = ZeroGateResult['plane'];

export interface ZeroTestCase {
  id: string;
  plane: ZeroTestPlane;
  description: string;
  run: () => Promise<ZeroGateResult> | ZeroGateResult;
}

export interface ZeroTestRun {
  changeClass: ZeroChangeClass;
  requiredPlanes: readonly ZeroTestPlane[];
  results: ZeroGateResult[];
  passed: boolean;
}

export async function runZeroTests(
  changeClass: ZeroChangeClass,
  tests: readonly ZeroTestCase[],
): Promise<ZeroTestRun> {
  const requiredPlanes = requiredTestPlanes[changeClass];
  const results: ZeroGateResult[] = [];

  for (const plane of requiredPlanes) {
    const planeTests = tests.filter((test) => test.plane === plane);
    if (planeTests.length === 0) {
      results.push({
        id: `missing:${plane}`,
        plane,
        status: 'fail',
        required: true,
        summary: `required ${plane} test plane has no registered tests`,
      });
      continue;
    }

    for (const test of planeTests) {
      try {
        const result = await test.run();
        results.push({ ...result, id: result.id || test.id, plane, required: true });
      } catch (error) {
        results.push({
          id: test.id,
          plane,
          status: 'fail',
          required: true,
          summary: error instanceof Error ? error.message : 'test threw a non-Error value',
        });
      }
    }
  }

  return {
    changeClass,
    requiredPlanes,
    results,
    passed: results.every((result) => result.status === 'pass'),
  };
}
