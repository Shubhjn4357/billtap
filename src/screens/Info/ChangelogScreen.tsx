import React from 'react';
import { ScrollView, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { AppCard } from '../../components/common/AppCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { APP_CHANGELOG, CHANGELOG_TEXT } from '../../constants/staticText';

export const ChangelogScreen = () => {
    const theme = useTheme();

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 120 }}>
                <Text variant="headlineMedium" style={{ fontWeight: '700' }}>
                    {CHANGELOG_TEXT.title}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 6, marginBottom: 12 }}>
                    {CHANGELOG_TEXT.subtitle}
                </Text>

                {APP_CHANGELOG.map((entry) => (
                    <AppCard key={entry.version}>
                        <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                            v{entry.version}
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 4 }}>
                            {CHANGELOG_TEXT.releasedPrefix} {entry.releasedOn}
                        </Text>
                        <View style={{ marginTop: 8 }}>
                            {entry.highlights.map((item) => (
                                <Text key={`${entry.version}-${item}`} variant="bodyMedium" style={{ marginBottom: 8 }}>
                                    - {item}
                                </Text>
                            ))}
                        </View>
                    </AppCard>
                ))}
            </ScrollView>
        </ScreenWrapper>
    );
};
