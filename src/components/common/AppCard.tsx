import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { Card, useTheme } from 'react-native-paper';

type AppCardProps = React.ComponentProps<typeof Card> & {
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    children: React.ReactNode;
    animationDelay?: number;
    disableMotion?: boolean;
};

let appCardMountCounter = 0;
const getNextAutoDelay = () => {
    const delay = (appCardMountCounter % 10) * 24;
    appCardMountCounter += 1;
    return delay;
};

export const AppCard: React.FC<AppCardProps> = ({
    style,
    contentStyle,
    children,
    animationDelay,
    disableMotion = false,
    ...props
}) => {
    const theme = useTheme();
    const autoDelayRef = React.useRef<number>(getNextAutoDelay());
    const resolvedDelay = animationDelay ?? autoDelayRef.current;

    return (
        <MotiView
            from={disableMotion ? undefined : { opacity: 0.9, translateY: 12, scale: 0.99 }}
            animate={{ opacity: 1, translateY: 0, scale: 1 }}
            transition={{
                type: 'timing',
                duration: disableMotion ? 1 : 280,
                delay: disableMotion ? 0 : resolvedDelay,
            }}
        >
            <Card
                mode="elevated"
                style={[
                    styles.card,
                    {
                        backgroundColor: theme.dark ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.7)',
                        borderColor: theme.dark ? 'rgba(148,163,184,0.22)' : 'rgba(148,163,184,0.2)',
                        shadowColor: '#020617',
                    },
                    style,
                ]}
                {...props}
            >
                <View
                    pointerEvents="none"
                    style={[
                        styles.glassGloss,
                        {
                            backgroundColor: theme.dark ? 'rgba(191,204,217,0.06)' : 'rgba(255,255,255,0.3)',
                        },
                    ]}
                />
                <Card.Content style={[styles.content, contentStyle]}>
                    {children}
                </Card.Content>
            </Card>
        </MotiView>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 18,
        borderWidth: 1,
        marginBottom: 10,
        overflow: 'hidden',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
        elevation: 4,
    },
    glassGloss: {
        position: 'absolute',
        top: 0,
        right: 0,
        left: 0,
        height: 36,
    },
    content: {
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
});
