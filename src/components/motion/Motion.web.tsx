import React from 'react';
import { View, type ViewProps } from 'react-native';

type MotionProps = ViewProps & {
    from?: unknown;
    animate?: unknown;
    exit?: unknown;
    transition?: unknown;
    state?: unknown;
};

export const MotionView = React.forwardRef<View, MotionProps>((
    {
        from: _from,
        animate: _animate,
        exit: _exit,
        transition: _transition,
        state: _state,
        ...props
    },
    ref
) => {
    return <View ref={ref} {...props} />;
});

MotionView.displayName = 'MotionView';

type MotionPresenceProps = {
    children?: React.ReactNode;
};

export const MotionPresence = ({ children }: MotionPresenceProps) => {
    return <>{children}</>;
};
