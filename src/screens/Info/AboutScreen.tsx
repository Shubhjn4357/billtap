import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { DesignSystem } from '../../constants/DesignSystem';
import { ABOUT_TEXT, BRAND } from '../../constants/staticText';

export const AboutScreen = () => {
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
