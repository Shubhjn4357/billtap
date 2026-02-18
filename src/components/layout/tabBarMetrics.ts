export const CURVED_TAB_BAR_HEIGHT = 66;
export const CURVED_TAB_BAR_FALLBACK_BOTTOM_GUTTER = 10;
export const CURVED_TAB_CONTENT_GAP = 10;
export const SIDEBAR_BREAKPOINT = 900;
export const SIDEBAR_NAV_WIDTH = 88;
export const SIDEBAR_NAV_MARGIN = 12;
export const SIDEBAR_CONTENT_GAP = 14;

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

export const shouldUseSidebarNavigation = (windowWidth: number) => {
    return windowWidth >= SIDEBAR_BREAKPOINT;
};

export const getTabAwareLeftSpacing = (safeLeftInset: number, extra = SIDEBAR_CONTENT_GAP) => {
    return safeLeftInset + SIDEBAR_NAV_MARGIN + SIDEBAR_NAV_WIDTH + extra;
};
