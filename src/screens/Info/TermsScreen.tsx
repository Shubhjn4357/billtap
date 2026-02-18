import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { DesignSystem } from '../../constants/DesignSystem';
import { BRAND, LEGAL_TEXT, TERMS_SECTIONS } from '../../constants/staticText';

export const TermsScreen = () => {
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
                    title={LEGAL_TEXT.termsTitle}
                    subtitle={`${LEGAL_TEXT.lastUpdatedPrefix} ${BRAND.legalLastUpdated}`}
                />

                {TERMS_SECTIONS.map((section) => (
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
