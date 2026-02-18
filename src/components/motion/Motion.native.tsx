import React from 'react';
import { Platform, View, type ViewProps } from 'react-native';
import { AnimatePresence, MotiView } from 'moti';

const enableRichMotion =
    Platform.OS === 'ios' || String(process.env.EXPO_PUBLIC_ENABLE_RICH_MOTION ?? '').toLowerCase() === 'true';

type MotionProps = React.ComponentProps<typeof MotiView> & {
    from?: unknown;
    animate?: unknown;
    exit?: unknown;
    transition?: unknown;
    state?: unknown;
};

export const MotionView = React.forwardRef<View, MotionProps>(
    ({ from, animate, exit, transition, state, ...props }, ref) => {
        if (!enableRichMotion) {
            return <View ref={ref} {...(props as ViewProps)} />;
        }

        return (
            <MotiView
                ref={ref}
                from={from}
                animate={animate}
                exit={exit}
                transition={transition}
                state={state}
                {...props}
            />
        );
    }
);

MotionView.displayName = 'MotionView';

export const MotionPresence = ({ children }: { children?: React.ReactNode }) => {
    if (!enableRichMotion) {
        return <>{children}</>;
    }
    return <AnimatePresence>{children}</AnimatePresence>;
};
