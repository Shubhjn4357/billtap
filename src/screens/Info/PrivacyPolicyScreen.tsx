import React from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { BRAND, LEGAL_TEXT, PRIVACY_SECTIONS } from '../../constants/staticText';

export const PrivacyPolicyScreen = () => {
    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 120 }}>
                <PageHeaderCard
                    title={LEGAL_TEXT.privacyTitle}
                    subtitle={`${LEGAL_TEXT.lastUpdatedPrefix} ${BRAND.legalLastUpdated}`}
                />

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
