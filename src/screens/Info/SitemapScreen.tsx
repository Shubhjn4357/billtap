import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chip, Text, useTheme } from 'react-native-paper';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { APP_SITEMAP, SITEMAP_TEXT, type SitemapEntry } from '../../constants/staticText';
import { useAuth } from '../../hooks/useAuth';

const accessLabel = (access: SitemapEntry['access']) => {
    return SITEMAP_TEXT.accessLabels[access];
};

export const SitemapScreen = () => {
    const theme = useTheme();
    const router = useRouter();
    const { user } = useAuth();

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 120 }}>
                <Text variant="headlineMedium" style={{ fontWeight: '700' }}>
                    {SITEMAP_TEXT.title}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 6, marginBottom: 12 }}>
                    {SITEMAP_TEXT.subtitle}
                </Text>

                {APP_SITEMAP.map((entry) => {
                    const needsAdmin = entry.access === 'admin';
                    const canOpen = !needsAdmin || user?.role === 'admin';

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
                                disabled={!canOpen}
                                onPress={() => router.push(entry.route as never)}
                            >
                                {SITEMAP_TEXT.openButton}
                            </AppButton>
                        </AppCard>
                    );
                })}
            </ScrollView>
        </ScreenWrapper>
    );
};
