import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Chip, Text, useTheme } from 'react-native-paper';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { DesignSystem } from '../../constants/DesignSystem';
import { APP_SITEMAP, SITEMAP_TEXT, type SitemapEntry } from '../../constants/staticText';

const accessLabel = (access: SitemapEntry['access']) => {
    return SITEMAP_TEXT.accessLabels[access];
};

export const SitemapScreen = () => {
    const theme = useTheme();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isWide = width >= 1120;

    return (
        <ScreenWrapper>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                <PageHeaderCard
                    title={SITEMAP_TEXT.title}
                    subtitle={SITEMAP_TEXT.subtitle}
                />

                {APP_SITEMAP.map((entry) => {
                    return (
                        <AppCard key={entry.route}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View style={{ flex: 1, marginRight: 12 }}>
                                    <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                                        {entry.title}
                                    </Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 2 }}>
                                        {entry.description}
                                    </Text>
                                    <Text variant="bodySmall" style={{ marginTop: 6 }}>
                                        {SITEMAP_TEXT.routePrefix} {entry.route}
                                    </Text>
                                </View>
                                <Chip compact>{accessLabel(entry.access)}</Chip>
                            </View>
                            <AppButton
                                mode="outlined"
                                compact
                                style={{ marginTop: 10 }}
                                onPress={() => router.push(entry.route as never)}
                            >
                                {SITEMAP_TEXT.openButton}
                            </AppButton>
                        </AppCard>
                    );
                })}
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingTop: DesignSystem.layout.pageTop,
        paddingBottom: DesignSystem.layout.pageBottom,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.pageMaxWidth,
    },
});
