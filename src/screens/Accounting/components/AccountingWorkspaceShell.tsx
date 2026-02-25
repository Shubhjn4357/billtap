import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chip , Text } from 'react-native-paper';

import { AppAccordion } from '../../../components/common/AppAccordion';
import { AppButton } from '../../../components/common/AppButton';
import { AppCard } from '../../../components/common/AppCard';
import { AppDateField } from '../../../components/common/AppDateField';
import { AppPullToRefresh } from '../../../components/common/AppPullToRefresh';
import { PageHeaderCard } from '../../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../../components/layout/ScreenWrapper';
import { DesignSystem } from '../../../constants/DesignSystem';
import { ACCOUNTING_SEGMENTS, type AccountingSegmentKey } from '../accountingSegments';
import { useAccountingRange } from '../context/AccountingRangeContext';

interface AccountingWorkspaceShellProps {
    title: string;
    subtitle: string;
    activeSegment: AccountingSegmentKey;
    refreshing: boolean;
    onRefresh: () => void;
    children: React.ReactNode;
}

export const AccountingWorkspaceShell = ({
    title,
    subtitle,
    activeSegment,
    refreshing,
    onRefresh,
    children,
}: AccountingWorkspaceShellProps) => {
    const router = useRouter();
    const { startDate, endDate, setRange, clearRange, rangeLabel } = useAccountingRange();
    const [draftStartDate, setDraftStartDate] = useState<Date | undefined>(startDate);
    const [draftEndDate, setDraftEndDate] = useState<Date | undefined>(endDate);
    const [rangeExpanded, setRangeExpanded] = useState(false);

    const activeSegmentLabel = useMemo(
        () => ACCOUNTING_SEGMENTS.find((segment) => segment.key === activeSegment)?.label ?? 'Accounting',
        [activeSegment]
    );

    const navigateSegment = (segmentKey: AccountingSegmentKey) => {
        const next = ACCOUNTING_SEGMENTS.find((segment) => segment.key === segmentKey);
        if (!next) return;
        router.push(next.route as never);
    };

    const handleApplyRange = () => {
        setRange(draftStartDate, draftEndDate);
        setRangeExpanded(false);
    };

    return (
        <ScreenWrapper>
            <AppPullToRefresh refreshing={refreshing} onRefresh={onRefresh}>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={styles.contentInner}>
                        <PageHeaderCard
                            title={title}
                            subtitle={subtitle}
                            right={(
                                <AppButton
                                    compact
                                    mode="contained-tonal"
                                    style={styles.controlButton}
                                    icon={rangeExpanded ? 'chevron-up' : 'calendar-range'}
                                    onPress={() => {
                                        setDraftStartDate(startDate);
                                        setDraftEndDate(endDate);
                                        setRangeExpanded((current) => !current);
                                    }}
                                >
                                    {rangeExpanded ? 'Hide Range' : 'Range'}
                                </AppButton>
                            )}
                        />

                        <AppCard>
                            <View style={styles.segmentRow}>
                                {ACCOUNTING_SEGMENTS.map((segment) => (
                                    <AppButton
                                        key={segment.key}
                                        compact
                                        mode={segment.key === activeSegment ? 'contained' : 'outlined'}
                                        style={styles.segmentButton}
                                        onPress={() => navigateSegment(segment.key)}
                                    >
                                        {segment.label}
                                    </AppButton>
                                ))}
                            </View>
                            <View style={styles.infoRow}>
                                <Chip compact icon="calendar-range">
                                    {rangeLabel}
                                </Chip>
                                <Chip compact icon="shape-outline">
                                    {activeSegmentLabel}
                                </Chip>
                            </View>
                        </AppCard>

                        <AppAccordion
                            title="Date Range Controls"
                            icon="calendar-edit-outline"
                            expanded={rangeExpanded}
                            onExpandedChange={setRangeExpanded}
                            containerStyle={styles.rangeAccordion}
                        >
                            <AppDateField
                                label="Start Date"
                                value={draftStartDate}
                                onChange={setDraftStartDate}
                                placeholder="Any"
                            />
                            <AppDateField
                                label="End Date"
                                value={draftEndDate}
                                onChange={setDraftEndDate}
                                placeholder="Any"
                                minimumDate={draftStartDate}
                            />
                            <View style={styles.rangeActionRow}>
                                <AppButton mode="contained" onPress={handleApplyRange} style={styles.rangeActionButton}>
                                    Apply
                                </AppButton>
                                <AppButton
                                    mode="outlined"
                                    onPress={() => {
                                        clearRange();
                                        setDraftStartDate(undefined);
                                        setDraftEndDate(undefined);
                                        setRangeExpanded(false);
                                    }}
                                    style={styles.rangeActionButton}
                                >
                                    Clear
                                </AppButton>
                            </View>
                            <Text variant="bodySmall" style={styles.rangeHint}>
                                One shared date range applies to all accounting segments.
                            </Text>
                        </AppAccordion>

                        {children}
                    </View>
                </ScrollView>
            </AppPullToRefresh>
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
        maxWidth: DesignSystem.layout.workspaceMaxWidth,
        gap: DesignSystem.layout.sectionGap,
    },
    controlButton: {
        borderRadius: DesignSystem.radius.pill,
    },
    segmentRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    segmentButton: {
        borderRadius: DesignSystem.radius.pill,
    },
    infoRow: {
        marginTop: 8,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    rangeAccordion: {
        marginBottom: 0,
    },
    rangeActionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    rangeActionButton: {
        flex: 1,
        borderRadius: DesignSystem.radius.pill,
    },
    rangeHint: {
        marginTop: 8,
        opacity: 0.72,
    },
});
