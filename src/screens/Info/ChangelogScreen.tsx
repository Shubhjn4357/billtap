import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { DesignSystem } from '../../constants/DesignSystem';
import { APP_CHANGELOG, CHANGELOG_TEXT } from '../../constants/staticText';

export const ChangelogScreen = () => {
    const theme = useTheme();
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
                    title={CHANGELOG_TEXT.title}
                    subtitle={CHANGELOG_TEXT.subtitle}
                />

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
