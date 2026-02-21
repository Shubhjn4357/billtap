/**
 * Vahi Design System — Spatial, Motion & Shadow Tokens
 * No hardcoded values anywhere in screens — always reference these exports.
 */

export const DesignSystem = {
    layout: {
        contentMaxWidth: 1240,
        compactMaxWidth: 680,
        formMaxWidth: 860,
        pageMaxWidth: 980,
        workspaceMaxWidth: 1200,
        dashboardMaxWidth: 1320,
        pageTop: 16,
        pageBottom: 120,
        sectionGap: 10,
        /** Height of the floating TopProfilePill header (including its own padding). */
        pillHeaderHeight: 58,
        /** How much top padding a screen needs to sit below the pill header. */
        pillTopOffset: 70,
    },
    radius: {
        xxs: 4,
        xs: 8,
        sm: 12,
        md: 16,
        lg: 20,
        xl: 24,
        xxl: 32,
        pill: 999,
    },
    spacing: {
        xxs: 2,
        xs: 6,
        sm: 10,
        md: 14,
        lg: 18,
        xl: 24,
        xxl: 36,
        xxxl: 56,
    },
    motion: {
        fast: 120,
        normal: 220,
        slow: 320,
        loader: 3500,
    },
    opacity: {
        borderLight: 0.10,
        borderMedium: 0.18,
        borderDark: 0.28,
        mutedText: 0.68,
        disabledControl: 0.38,
    },
    shadow: {
        /** Material-style card shadow (iOS/Web) */
        card: {
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3,
        },
        /** Floating element (pill, FAB) */
        float: {
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.14,
            shadowRadius: 14,
            elevation: 8,
        },
        /** Modal / sheet */
        modal: {
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.12,
            shadowRadius: 20,
            elevation: 16,
        },
    },
} as const;

export type DesignSpacing = keyof typeof DesignSystem.spacing;
export type DesignRadius = keyof typeof DesignSystem.radius;
