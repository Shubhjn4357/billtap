import React from 'react';
import { ScrollView, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { AppCard } from '../../components/common/AppCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { BRAND, LEGAL_TEXT, PRIVACY_SECTIONS } from '../../constants/staticText';

export const PrivacyPolicyScreen = () => {
    const theme = useTheme();

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 120 }}>
                <Text variant="headlineMedium" style={{ fontWeight: '700' }}>
                    {LEGAL_TEXT.privacyTitle}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 6, marginBottom: 12 }}>
                    {LEGAL_TEXT.lastUpdatedPrefix} {BRAND.legalLastUpdated}
                </Text>

                {PRIVACY_SECTIONS.map((section) => (
                    <AppCard key={section.title}>
                        <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                            {section.title}
                        </Text>
                        <View style={{ marginTop: 8 }}>
                            {section.paragraphs.map((paragraph) => (
                                <Text key={`${section.title}-${paragraph}`} variant="bodyMedium" style={{ marginBottom: 8 }}>
                                    {paragraph}
                                </Text>
                            ))}
                        </View>
                    </AppCard>
                ))}
            </ScrollView>
        </ScreenWrapper>
    );
};
