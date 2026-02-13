import React, { useRef, useState } from 'react';
import { View, FlatList, StyleSheet, useWindowDimensions, Animated, type ViewToken } from 'react-native';
import { Text, useTheme, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '../../store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppButton } from '../../components/common/AppButton';
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
        <View style={{ flexDirection: 'row', height: 64 }}>
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
        router.replace('/login');
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={{ flex: 3 }}>
                <FlatList
                    data={slides}
                    renderItem={({ item }) => (
                        <View style={[styles.slide, { width }]}>
                            <MaterialCommunityIcons 
                                name={item.icon}
                                size={120} 
                                color={theme.colors.primary} 
                                style={{ marginBottom: 40 }}
                            />
                            <Text variant="headlineLarge" style={{ color: theme.colors.primary, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' }}>
                                {item.title}
                            </Text>
                            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', paddingHorizontal: 40 }}>
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
                    scrollEventThrottle={32}
                    onViewableItemsChanged={viewableItemsChanged}
                    viewabilityConfig={viewConfig}
                    ref={slidesRef}
                />
            </View>

            <View style={styles.footer}>
                <Paginator data={slides} scrollX={scrollX} />
                
                <View style={{ width: '80%', marginBottom: 20 }}>
                    <AppButton 
                        mode="contained" 
                        onPress={scrollTo}
                        contentStyle={{ height: 48 }}
                    >
                        {currentIndex === slides.length - 1 ? COMMON_TEXT.actions.getStarted : COMMON_TEXT.actions.next}
                    </AppButton>
                    
                    {currentIndex < slides.length - 1 && (
                        <Button 
                            mode="text" 
                            onPress={finishOnboarding} 
                            style={{ marginTop: 10 }}
                            textColor={theme.colors.secondary}
                        >
                            {COMMON_TEXT.actions.skip}
                        </Button>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    slide: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingBottom: 20
    },
    dot: {
        height: 10,
        borderRadius: 5,
        marginHorizontal: 8,
    },
});
