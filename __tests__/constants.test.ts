import { describe, it, expect } from '@jest/globals';
import { Radius, Spacing, Typography } from '../src/constants/theme';

describe('Admin Theme Constants', () => {
  it('should export valid Radius values', () => {
    expect(Radius.md).toBeDefined();
    expect(Radius.card).toBeDefined();
    expect(typeof Radius.md).toBe('number');
  });

  it('should export valid Spacing values', () => {
    expect(Spacing.sm).toBeDefined();
    expect(Spacing.lg).toBeDefined();
  });

  it('should export valid Typography settings', () => {
    expect(Typography.h1.size).toBe(32);
    expect(Typography.body.size).toBe(16);
  });
});
