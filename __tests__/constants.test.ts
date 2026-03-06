import { describe, it, expect } from 'vitest';
import { DEFAULT_PLAN_SEEDS, FREE_PLAN_ID } from '../../src/constants/defaultPlans';

describe('Server Constants', () => {
  it('should export valid FREE_PLAN_ID', () => {
    expect(FREE_PLAN_ID).toBeDefined();
    expect(typeof FREE_PLAN_ID).toBe('string');
  });

  it('should export DEFAULT_PLAN_SEEDS array containing free plan', () => {
    expect(Array.isArray(DEFAULT_PLAN_SEEDS)).toBe(true);
    expect(DEFAULT_PLAN_SEEDS.length).toBeGreaterThan(0);
    expect(DEFAULT_PLAN_SEEDS.some(plan => plan.id === FREE_PLAN_ID)).toBe(true);
  });
});
