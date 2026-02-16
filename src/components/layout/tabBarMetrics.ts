export const CURVED_TAB_BAR_HEIGHT = 72;
export const CURVED_TAB_BAR_FALLBACK_BOTTOM_GUTTER = 10;
export const CURVED_TAB_CONTENT_GAP = 12;

export const getCurvedTabBarBottomPadding = (safeBottomInset: number) => {
    return safeBottomInset > 0 ? safeBottomInset : CURVED_TAB_BAR_FALLBACK_BOTTOM_GUTTER;
};

// Use this for content/FAB offsets inside SafeAreaView containers.
export const getCurvedTabOverlayOffset = (safeBottomInset: number) => {
    return CURVED_TAB_BAR_HEIGHT + getCurvedTabBarBottomPadding(safeBottomInset);
};

export const getTabAwareBottomSpacing = (safeBottomInset: number, extra = CURVED_TAB_CONTENT_GAP) => {
    return getCurvedTabOverlayOffset(safeBottomInset) + extra;
};
