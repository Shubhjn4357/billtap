import React, { useRef, useState } from 'react';
import { View, FlatList, StyleSheet, useWindowDimensions, Animated, type ViewToken } from 'react-native';
import { Text, useTheme, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '../../store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { DesignSystem } from '../../constants/DesignSystem';
import { COMMON_TEXT, ONBOARDING_TEXT } from '../../constants/staticText';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const slides = ONBOARDING_TEXT.slides.map((slide) => ({
    ...slide,
    icon: slide.icon as IconName,
}));

const Paginator = ({ data, scrollX }: { data: typeof slides; scrollX: Animated.Value }) => {
    const { width } = useWindowDimensions();
    const theme = useTheme();

    return (
        <View style={{ flexDirection: 'row', height: 44, marginBottom: DesignSystem.spacing.sm }}>
            {data.map((_, i) => {
                const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                const dotWidth = scrollX.interpolate({
                    inputRange,
                    outputRange: [10, 20, 10],
                    extrapolate: 'clamp',
                });
                const opacity = scrollX.interpolate({
                    inputRange,
                    outputRange: [0.3, 1, 0.3],
                    extrapolate: 'clamp',
                });

                return (
                    <Animated.View
                        key={i.toString()}
                        style={[
                            styles.dot,
                            { width: dotWidth, opacity, backgroundColor: theme.colors.primary },
                        ]}
                    />
                );
            })}
        </View>
    );
};

export const OnboardingScreen = () => {
    const theme = useTheme();
    const router = useRouter();
    const { setHasSeenOnboarding } = useSettingsStore();
    const { width } = useWindowDimensions();
    const scrollX = useRef(new Animated.Value(0)).current;
    const slidesRef = useRef<FlatList>(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    const viewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems && viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index ?? 0);
        }
    }).current;

    const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    const scrollTo = () => {
        if (currentIndex < slides.length - 1) {
            slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            finishOnboarding();
        }
    };

    const finishOnboarding = () => {
        setHasSeenOnboarding(true);
        router.replace('/(auth)/login' as any);
    };

    return (
        <ScreenWrapper>
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <PageHeaderCard
                    title="BillTap Quick Start"
                    subtitle="Set up billing, stock, and reports in under a minute."
                />

                <AppCard style={styles.slidesCard}>
                    <FlatList
                        data={slides}
                        renderItem={({ item }) => (
                            <View style={[styles.slide, { width: width - 40 }]}>
                                <View
                                    style={[
                                        styles.iconWrap,
                                        {
                                            backgroundColor: theme.colors.surfaceVariant,
                                            borderColor: theme.colors.outlineVariant,
                                        },
                                    ]}
                                >
                                    <MaterialCommunityIcons
                                        name={item.icon}
                                        size={52}
                                        color={theme.colors.primary}
                                    />
                                </View>
                                <Text variant="headlineSmall" style={[styles.slideTitle, { color: theme.colors.onSurface }]}>
                                    {item.title}
                                </Text>
                                <Text variant="bodyMedium" style={[styles.slideDescription, { color: theme.colors.onSurfaceVariant }]}>
                                    {item.description}
                                </Text>
                            </View>
                        )}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        pagingEnabled
                        bounces={false}
                        keyExtractor={(item) => item.id}
                        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
                            useNativeDriver: false,
                        })}
                        scrollEventThrottle={24}
                        onViewableItemsChanged={viewableItemsChanged}
                        viewabilityConfig={viewConfig}
                        ref={slidesRef}
                    />
                </AppCard>

                <View style={styles.footer}>
                    <Paginator data={slides} scrollX={scrollX} />
                    <View style={styles.footerActions}>
                        <AppButton
                            mode="contained"
                            onPress={scrollTo}
                            contentStyle={{ minHeight: 46 }}
                        >
                            {currentIndex === slides.length - 1 ? COMMON_TEXT.actions.getStarted : COMMON_TEXT.actions.next}
                        </AppButton>

                        {currentIndex < slides.length - 1 && (
                            <Button
                                mode="text"
                                onPress={finishOnboarding}
                                style={{ marginTop: DesignSystem.spacing.xs }}
                                textColor={theme.colors.secondary}
                            >
                                {COMMON_TEXT.actions.skip}
                            </Button>
                        )}
                    </View>
                </View>
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: DesignSystem.layout.pageTop,
    },
    slidesCard: {
        flex: 1,
    },
    slide: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: DesignSystem.spacing.lg,
    },
    iconWrap: {
        width: 108,
        height: 108,
        borderRadius: DesignSystem.radius.xl,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: DesignSystem.spacing.md,
    },
    slideTitle: {
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: DesignSystem.spacing.xs,
    },
    slideDescription: {
        textAlign: 'center',
        paddingHorizontal: DesignSystem.spacing.md,
    },
    footer: {
        alignItems: 'center',
        width: '100%',
        paddingBottom: DesignSystem.spacing.sm,
    },
    footerActions: {
        width: '100%',
        marginBottom: DesignSystem.spacing.xs,
    },
    dot: {
        height: 8,
        borderRadius: 6,
        marginHorizontal: 6,
    },
});
