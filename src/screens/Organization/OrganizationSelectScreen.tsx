import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import {
    ActivityIndicator,
    Avatar,
    Button,
    Card,
    IconButton,
    Surface,
    Text,
    useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { businessSuiteService, OrganizationMembership } from '../../api/businessSuiteService';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { useOrganizationStore } from '../../store';
import { DesignSystem } from '../../constants/DesignSystem';
import { useAppDialog } from '../../components/providers/DialogProvider';

export const OrganizationSelectScreen: React.FC = () => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const dialog = useAppDialog();
    const { refreshOrganizationContext, isOwnerOrAdmin } = useOrganizationAccess();
    const selectedOrganizationId = useOrganizationStore((state) => state.selectedOrganizationId);

    const [loading, setLoading] = useState(true);
    const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
    const [switchingId, setSwitchingId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const uniqueOrganizations = useMemo(() => {
        const map = new Map<string, OrganizationMembership>();
        organizations.forEach((entry) => {
            if (!map.has(entry.id)) {
                map.set(entry.id, entry);
            }
        });
        return Array.from(map.values());
    }, [organizations]);

    const loadOrganizations = async () => {
        try {
            setLoading(true);
            setErrorMessage(null);
            const data = await businessSuiteService.getMyOrganizations();
            setOrganizations(data);
        } catch (error: unknown) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to load organizations.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadOrganizations();
    }, []);

    const handleSelect = async (orgId: string) => {
        if (orgId === selectedOrganizationId) {
            router.back();
            return;
        }

        try {
            setSwitchingId(orgId);
            await refreshOrganizationContext(orgId);
            router.replace('/(main)/(tabs)/home');
        } catch (error: unknown) {
            dialog.alert('Switch Organization', error instanceof Error ? error.message : 'Failed to switch organization.');
        } finally {
            setSwitchingId(null);
        }
    };

    const renderItem = ({ item }: { item: OrganizationMembership }) => {
        const isSelected = item.id === selectedOrganizationId;
        const isSwitching = item.id === switchingId;

        return (
            <Card
                style={[
                    styles.card,
                    isSelected && { borderColor: theme.colors.primary, borderWidth: 2 },
                ]}
                onPress={() => void handleSelect(item.id)}
                disabled={Boolean(switchingId)}
            >
                <Card.Content style={styles.cardContent}>
                    <View style={styles.orgInfo}>
                        <Avatar.Text
                            size={40}
                            label={item.name.substring(0, 2).toUpperCase()}
                            style={{ backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceVariant }}
                            labelStyle={{ color: isSelected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}
                        />
                        <View style={styles.textContainer}>
                            <Text variant="titleMedium" style={styles.orgName}>{item.name}</Text>
                            <Text variant="labelSmall" style={styles.orgCode}>
                                {item.code} | {item.role.toUpperCase()}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.statusContainer}>
                        {isSwitching ? (
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                        ) : isSelected ? (
                            <IconButton icon="check-circle" iconColor={theme.colors.primary} size={24} />
                        ) : (
                            <IconButton icon="chevron-right" size={24} />
                        )}
                    </View>
                </Card.Content>
            </Card>
        );
    };

    return (
        <Surface style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <IconButton icon="arrow-left" onPress={() => router.back()} />
                <Text variant="headlineSmall" style={styles.title}>Switch Business</Text>
                {isOwnerOrAdmin ? (
                    <Button mode="text" compact onPress={() => router.push('/org-create')}>
                        Create
                    </Button>
                ) : null}
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.loadingText}>Loading your businesses...</Text>
                </View>
            ) : (
                <FlatList
                    data={uniqueOrganizations}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshing={loading}
                    onRefresh={() => { void loadOrganizations(); }}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Text variant="bodyLarge">No organizations found.</Text>
                            {isOwnerOrAdmin ? (
                                <Button mode="contained" onPress={() => router.push('/org-create')} style={styles.mt}>
                                    Create Organization
                                </Button>
                            ) : null}
                            {errorMessage ? (
                                <Text style={[styles.loadingText, { color: theme.colors.error }]}>
                                    {errorMessage}
                                </Text>
                            ) : null}
                        </View>
                    }
                />
            )}
        </Surface>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingBottom: 16,
    },
    title: {
        fontWeight: '700',
    },
    listContent: {
        padding: 16,
    },
    card: {
        marginBottom: 12,
        borderRadius: DesignSystem.radius.md,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    orgInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    textContainer: {
        marginLeft: 12,
        flex: 1,
    },
    orgName: {
        fontWeight: '600',
    },
    orgCode: {
        opacity: 0.6,
        textTransform: 'uppercase',
    },
    statusContainer: {
        width: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 12,
        opacity: 0.7,
    },
    mt: {
        marginTop: 20,
    },
});
