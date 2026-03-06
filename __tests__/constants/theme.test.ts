import { describe, it, expect } from 'vitest';
import { Radius, Spacing, Typography } from '../../src/constants/theme';

describe('Vahi App Theme Constants', () => {
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
    // Typography has: display, headline, title, body, caption, label, code (no h1)
    expect(Typography.display.size).toBeDefined();
    expect(typeof Typography.display.size).toBe('number');
    expect(Typography.body.size).toBeDefined();
    expect(Typography.caption.size).toBeDefined();
    expect(Typography.title.size).toBeDefined();
  });

  it('Typography keys match expected design scale', () => {
    const keys = Object.keys(Typography);
    expect(keys).toContain('display');
    expect(keys).toContain('headline');
    expect(keys).toContain('title');
    expect(keys).toContain('body');
    expect(keys).toContain('caption');
    expect(keys).not.toContain('h1'); // h1 was a typo — design system uses 'display'
  });

  it('Radius has pill and card values', () => {
    expect(Radius.pill).toBeDefined();
    expect(Radius.card).toBeDefined();
    expect(Radius.pill).toBeGreaterThan(Radius.card);
  });
});
