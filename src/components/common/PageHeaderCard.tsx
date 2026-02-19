import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { MotionView } from '../motion/Motion';
import { Text, useTheme } from 'react-native-paper';
import { AppCard } from './AppCard';
import { SyncIndicator } from './SyncIndicator';
import { DesignSystem } from '../../constants/DesignSystem';

type PageHeaderCardProps = {
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
};

export const PageHeaderCard: React.FC<PageHeaderCardProps> = ({ title, subtitle, right }) => {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const isCompact = width < 420;
    const titleFontSize = isCompact ? 22 : 26;
    const titleLineHeight = isCompact ? 28 : 32;
    const backgroundColor = theme.colors.surface;

    return (
        <MotionView
            from={{ opacity: 0.85, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: DesignSystem.motion.slow }}
        >
            <AppCard
                disableMotion
                style={{
                    backgroundColor,
                }}
            >

                <View style={styles.row}>
                    <View style={[styles.titleWrap, right ? styles.titleWrapWithAction : null]}>
                        <Text
                            variant="headlineSmall"
                            style={[
                                styles.title,
                                {
                                    color: theme.colors.onSurface,
                                    fontSize: titleFontSize,
                                    lineHeight: titleLineHeight,
                                },
                            ]}
                            numberOfLines={2}
                        >
                            {title}
                        </Text>
                        {!!subtitle && (
                            <Text
                                variant="bodyMedium"
                                style={[
                                    styles.subtitle,
                                    { color: theme.colors.onSurfaceVariant },
                                ]}
                                numberOfLines={2}
                            >
                                {subtitle}
                            </Text>
                        )}
                    </View>
                    <SyncIndicator />
                    {right ? <View style={styles.actionWrap}>{right}</View> : null}
                </View>
            </AppCard>
        </MotionView>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    titleWrap: {
        flex: 1,
    },
    titleWrapWithAction: {
        marginRight: 12,
    },
    title: {
        fontWeight: '800',
    },
    subtitle: {
        marginTop: 4,
        opacity: 0.92,
    },
    actionWrap: {
        marginLeft: DesignSystem.spacing.sm,
        paddingTop: 2,
    },
});
