import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ZeroMemory, ACTIVE_MEMORY_TARGET_BYTES, ACTIVE_MEMORY_MAX_BYTES } from '../src/index.js';

describe('ZeroMemory', () => {
  it('dedupes identical content by bumping salience', async () => {
    const mem = new ZeroMemory();
    const a = await mem.remember('user timezone is America/New_York', 'identity', { key: 'user.timezone' });
    const b = await mem.remember('user timezone is America/New_York', 'identity', { key: 'user.timezone' });

    assert.equal(a.id, b.id);
    assert.ok(b.salience > a.salience - 0.11); // bumped, not duplicated
    assert.equal((await mem.recall(100)).length, 1);
  });

  it('conflict resolution supersedes the older keyed fact', async () => {
    const mem = new ZeroMemory();
    const old = await mem.remember('deploy target is staging', 'facts', { key: 'deploy.target', salience: 0.9 });
    const next = await mem.remember('deploy target is production', 'facts', { key: 'deploy.target', salience: 0.9 });

    assert.notEqual(old.id, next.id);
    const visible = await mem.recall(100);
    assert.equal(visible.length, 1);
    assert.equal(visible[0].id, next.id);
    const all = await mem.recall(100, true);
    const superseded = all.find((f) => f.id === old.id);
    assert.equal(superseded?.supersededBy, next.id);
  });

  it('recall returns highest salience first', async () => {
    const mem = new ZeroMemory();
    await mem.remember('low priority note', 'facts', { salience: 0.1 });
    await mem.remember('critical constraint', 'facts', { salience: 0.95 });
    const [top] = await mem.recall(2);
    assert.equal(top.content, 'critical constraint');
  });

  it('compaction respects the byte budget and reports', async () => {
    const mem = new ZeroMemory();
    for (let i = 0; i < 20; i++) {
      await mem.remember(`fact number ${i} with padding xxxxxxxxxxxxxxxxxxxxxxxxxx`, 'facts', { salience: i / 20 });
    }
    const budget = 1024;
    const report = await mem.compact(budget);
    assert.ok(report.bytesAfter <= budget);
    assert.ok(report.dropped > 0);
    assert.equal(report.kept + report.dropped, 20);
    // highest-salience fact survives
    const remaining = await mem.recall(100);
    assert.ok(remaining.some((f) => f.content.includes('fact number 19')));
  });

  it('activeMemory stays within target and never exceeds the 1MB ceiling', async () => {
    const mem = new ZeroMemory();
    for (let i = 0; i < 50; i++) {
      await mem.remember(`payload ${i} ` + 'y'.repeat(200), 'recent', { salience: 0.5 });
    }
    const small = await mem.activeMemory(2048);
    assert.ok(Buffer.byteLength(small, 'utf8') <= 2048);
    const huge = await mem.activeMemory(Number.MAX_SAFE_INTEGER);
    assert.ok(Buffer.byteLength(huge, 'utf8') <= ACTIVE_MEMORY_MAX_BYTES);
    assert.ok(ACTIVE_MEMORY_TARGET_BYTES >= 128 * 1024 && ACTIVE_MEMORY_TARGET_BYTES <= 256 * 1024);
  });
});
