/**
 * @file constants.test.ts
 * @description Validates that design constants, color palettes, and theme tokens
 * meet production-grade consistency requirements.
 */
import { vi, describe, expect, it } from 'vitest';

import { DesignSystem } from '../../constants/DesignSystem';
import { Colors } from '../../constants/Colors';
import { lightTheme, darkTheme } from '../../constants/Theme';
import { PREDEFINED_CATEGORIES, getCategoryByKey } from '../../constants/categories';
import { PREDEFINED_UNITS, getUnitByKey } from '../../constants/units';

// Mock react-native-paper before any imports that use it
vi.mock('react-native-paper', () => ({
    MD3LightTheme: { colors: {}, dark: false },
    MD3DarkTheme: { colors: {}, dark: true },
}));

// --- DesignSystem ---------------------------------------------------------------

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

// --- Colors ---------------------------------------------------------------------

describe('Colors', () => {
    const colorHexPattern = /^#[0-9A-Fa-f]{3,8}$/;

    it('light and dark themes have the same set of keys', () => {
        const lightKeys = Object.keys(Colors.light).sort();
        const darkKeys = Object.keys(Colors.dark).sort();
        expect(lightKeys).toEqual(darkKeys);
    });

    it('all color values are valid hex strings', () => {
        for (const [key, value] of Object.entries(Colors.light)) {
            if (typeof value === 'string' && value.startsWith('#')) {
                expect(value, `Colors.light.${key}`).toMatch(colorHexPattern);
            }
        }
        for (const [key, value] of Object.entries(Colors.dark)) {
            if (typeof value === 'string' && value.startsWith('#')) {
                expect(value, `Colors.dark.${key}`).toMatch(colorHexPattern);
            }
        }
    });
});

// --- Theme ----------------------------------------------------------------------

describe('Theme', () => {
    it('lightTheme and darkTheme are defined', () => {
        expect(lightTheme).toBeDefined();
        expect(darkTheme).toBeDefined();
    });

    it('themes are dark/light flagged correctly', () => {
        expect(lightTheme.dark).toBe(false);
        expect(darkTheme.dark).toBe(true);
    });
});

// --- Categories -----------------------------------------------------------------

describe('Categories', () => {
    it('defines at least 10 categories', () => {
        expect(PREDEFINED_CATEGORIES.length).toBeGreaterThanOrEqual(10);
    });

    it('getCategoryByKey returns correct category', () => {
        const cat = getCategoryByKey('grocery');
        expect(cat.key).toBe('grocery');
    });
});

// --- Units ----------------------------------------------------------------------

describe('Units', () => {
    it('defines units', () => {
        expect(PREDEFINED_UNITS.length).toBeGreaterThanOrEqual(5);
    });

    it('getUnitByKey returns the correct unit', () => {
        const unit = getUnitByKey('kg');
        expect(unit.key).toBe('kg');
    });
});
