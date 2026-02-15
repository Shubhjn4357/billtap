import React from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { ABOUT_TEXT, BRAND } from '../../constants/staticText';

export const AboutScreen = () => {
    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 120 }}>
                <PageHeaderCard
                    title={ABOUT_TEXT.title}
                    subtitle={`${ABOUT_TEXT.lastUpdatedPrefix} ${BRAND.legalLastUpdated}`}
                />

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                        {ABOUT_TEXT.whatWeDoTitle}
                    </Text>
                    <View style={{ marginTop: 8 }}>
                        {ABOUT_TEXT.summary.map((entry) => (
                            <Text key={entry} variant="bodyMedium" style={{ marginBottom: 8 }}>
                                - {entry}
                            </Text>
                        ))}
                    </View>
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                        {ABOUT_TEXT.contactTitle}
                    </Text>
                    <Text variant="bodyMedium" style={{ marginTop: 8 }}>
                        {ABOUT_TEXT.supportLabel}: {BRAND.supportEmail}
                    </Text>
                    <Text variant="bodyMedium" style={{ marginTop: 4 }}>
                        {ABOUT_TEXT.salesLabel}: {BRAND.salesEmail}
                    </Text>
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                        {ABOUT_TEXT.legalNoticeTitle}
                    </Text>
                    <Text variant="bodyMedium" style={{ marginTop: 8 }}>
                        {ABOUT_TEXT.legalNotice}
                    </Text>
                </AppCard>
            </ScrollView>
        </ScreenWrapper>
    );
};
