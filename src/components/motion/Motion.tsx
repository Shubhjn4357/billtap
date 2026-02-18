import React from 'react';
import { Platform, View, type ViewProps } from 'react-native';

type MotionProps = ViewProps & {
    from?: unknown;
    animate?: unknown;
    exit?: unknown;
    transition?: unknown;
    state?: unknown;
};

const motiRuntime = (() => {
    if (Platform.OS === 'web') return null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('moti') as typeof import('moti');
    } catch {
        return null;
    }
})();

const stripMotionProps = (props: MotionProps): ViewProps => {
    const {
        from: _from,
        animate: _animate,
        exit: _exit,
        transition: _transition,
        state: _state,
        ...rest
    } = props;
    return rest;
};

export const MotionView = React.forwardRef<View, MotionProps>((props, ref) => {
    if (!motiRuntime?.MotiView) {
        return <View ref={ref} {...stripMotionProps(props)} />;
    }

    const { MotiView } = motiRuntime;
    return <MotiView ref={ref as never} {...(props as any)} />;
});

MotionView.displayName = 'MotionView';

type MotionPresenceProps = {
    children?: React.ReactNode;
    initial?: boolean;
    exitBeforeEnter?: boolean;
    onExitComplete?: () => void;
};

export const MotionPresence = ({ children, ...props }: MotionPresenceProps) => {
    if (!motiRuntime?.AnimatePresence) {
        return <>{children}</>;
    }

    const { AnimatePresence } = motiRuntime;
    return <AnimatePresence {...props}>{children}</AnimatePresence>;
};
