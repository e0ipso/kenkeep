import { describe, expect, it } from 'vitest';
import { MIGRATION_STEPS, planMigration, type MigrationStep } from '../../src/lib/migrate.js';

// planMigration is pure chain resolution, so it gets plain unit coverage: the
// real registry's single step, multi-hop ordering over synthetic steps, and
// the loud failure when a gap has no step. detectSchemaVersion is exercised
// elsewhere against real trees and needs no probe here.
describe('planMigration', () => {
  it('resolves the real registry to the single flat-to-tree step', () => {
    const chain = planMigration(MIGRATION_STEPS, 1, 2);
    expect(chain).toHaveLength(1);
    expect(chain[0].id).toBe('flat-to-tree');
    expect(chain[0].from).toBe(1);
    expect(chain[0].to).toBe(2);
  });

  it('chains multiple synthetic steps in from-order', () => {
    const steps: readonly MigrationStep[] = [
      { id: 'two-to-three', from: 2, to: 3, primitives: ['b'] },
      { id: 'one-to-two', from: 1, to: 2, primitives: ['a'] },
    ];
    const chain = planMigration(steps, 1, 3);
    expect(chain.map(s => s.id)).toEqual(['one-to-two', 'two-to-three']);
  });

  it('returns an empty chain when current already meets the target', () => {
    expect(planMigration(MIGRATION_STEPS, 2, 2)).toEqual([]);
  });

  it('throws loudly when no step covers the running version', () => {
    const steps: readonly MigrationStep[] = [{ id: 'one-to-two', from: 1, to: 2, primitives: [] }];
    expect(() => planMigration(steps, 2, 3)).toThrow('No step from schema_version 2 toward 3.');
  });
});
