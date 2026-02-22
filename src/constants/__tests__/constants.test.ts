/**
 * @file constants.test.ts
 * @description Validates that design constants, color palettes, and theme tokens
 * meet production-grade consistency requirements.
 */
import { describe, expect, it } from 'vitest';
import { DesignSystem } from '../../constants/DesignSystem';
import { Colors } from '../../constants/Colors';
import { lightTheme, darkTheme } from '../../constants/Theme';
import { PREDEFINED_CATEGORIES, getCategoryByKey, DEFAULT_CATEGORY } from '../../constants/categories';
import { PREDEFINED_UNITS, getUnitByKey } from '../../constants/units';

describe('DesignSystem', () => {
    describe('spacing', () => {
        it('defines all required spacing tokens', () => {
            const required = ['xxs', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'xxxl'] as const;
            for (const key of required) {
                expect(DesignSystem.spacing).toHaveProperty(key);
            }
        });

        it('spacing tokens are monotonically increasing', () => {
            const tokens = [
                DesignSystem.spacing.xxs,
                DesignSystem.spacing.xs,
                DesignSystem.spacing.sm,
                DesignSystem.spacing.md,
                DesignSystem.spacing.lg,
                DesignSystem.spacing.xl,
                DesignSystem.spacing.xxl,
                DesignSystem.spacing.xxxl,
            ];
            for (let i = 1; i < tokens.length; i++) {
                expect(tokens[i]).toBeGreaterThan(tokens[i - 1]);
            }
        });
    });

    describe('radius', () => {
        it('defines the required border radius tokens', () => {
            const required = ['xxs', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'pill'] as const;
            for (const key of required) {
                expect(DesignSystem.radius).toHaveProperty(key);
            }
        });
    });

    describe('opacity', () => {
        it('defines disabledControl opacity', () => {
            expect(DesignSystem.opacity).toHaveProperty('disabledControl');
            expect(DesignSystem.opacity.disabledControl).toBeGreaterThan(0);
            expect(DesignSystem.opacity.disabledControl).toBeLessThanOrEqual(1);
        });
    });
});

describe('Colors', () => {
    const colorHexPattern = /^#[0-9A-Fa-f]{3,8}$/;

    it('light and dark themes have the same set of keys', () => {
        const lightKeys = Object.keys(Colors.light).sort();
        const darkKeys = Object.keys(Colors.dark).sort();
        expect(lightKeys).toEqual(darkKeys);
    });

    it('all color values are valid hex strings', () => {
        for (const [key, value] of Object.entries(Colors.light)) {
            expect(value, `Colors.light.${key}`).toMatch(colorHexPattern);
        }
        for (const [key, value] of Object.entries(Colors.dark)) {
            expect(value, `Colors.dark.${key}`).toMatch(colorHexPattern);
        }
    });
});

describe('Theme', () => {
    it('lightTheme and darkTheme have the same color keys', () => {
        const lightKeys = Object.keys(lightTheme.colors).sort();
        const darkKeys = Object.keys(darkTheme.colors).sort();
        expect(lightKeys).toEqual(darkKeys);
    });

    it('themes are dark/light flagged correctly', () => {
        expect(lightTheme.dark).toBe(false);
        expect(darkTheme.dark).toBe(true);
    });
});
