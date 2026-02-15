
import React, { useEffect, useState } from 'react';
import { View, FlatList } from 'react-native';
import { Text, FAB, List, Chip, useTheme, ActivityIndicator } from 'react-native-paper';
import { useRouter, Href } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { useUserStore } from '../../store';
import { staffService } from '../../api/staffService';
import type { UserProfile, StaffInvite } from '../../types';

// Mock service for now, or use axios directly
// We should prefer creating a service file
// import axios from 'axios';
// import { Config } from '../../constants/Config';

export const StaffListScreen = () => {
    const theme = useTheme();
    const router = useRouter();
    const { user } = useUserStore();
    const [staff, setStaff] = useState<UserProfile[]>([]);
    const [invites, setInvites] = useState<StaffInvite[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadStaff = async () => {
            if (!user || user.role !== 'owner') return;
            setLoading(true);
            try {
                const data = await staffService.getStaff();
                setStaff(data.staff);
                setInvites(data.invites);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        loadStaff();
    }, [user]);

    const renderStaffItem = ({ item }: { item: UserProfile }) => (
        <AppCard>
            <List.Item
                title={item.displayName || item.phoneNumber}
                description={item.role?.toUpperCase()}
                left={props => <List.Icon {...props} icon="account" />}
            />
        </AppCard>
    );

    const renderInviteItem = ({ item }: { item: StaffInvite }) => (
        <AppCard style={{ backgroundColor: theme.colors.surfaceVariant }}>
            <List.Item
                title={`Invited: ${item.phoneNumber}`}
                description={`Code: ${item.code} - Status: ${item.status}`}
                left={props => <List.Icon {...props} icon="email-outline" />}
                right={props => <Chip>{item.status}</Chip>}
            />
        </AppCard>
    );

    if (user?.role !== 'owner') {
        return (
            <ScreenWrapper>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: theme.colors.outline }}>Only owners can manage staff.</Text>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <View style={{ flex: 1, paddingTop: 16 }}>
                <PageHeaderCard
                    title="Staff Management"
                    subtitle={`${staff.length} active staff | ${invites.length} pending invite(s)`}
                />

                {loading ? (
                    <ActivityIndicator style={{ marginTop: 20 }} />
                ) : (
                    <>
                        <Text variant="titleMedium" style={{ marginTop: 10, marginBottom: 5 }}>Active Staff</Text>
                        <FlatList
                            data={staff}
                            keyExtractor={item => item.uid}
                            renderItem={renderStaffItem}
                            ListEmptyComponent={<Text style={{ fontStyle: 'italic', color: theme.colors.outline }}>No active staff.</Text>}
                        />

                        <Text variant="titleMedium" style={{ marginTop: 20, marginBottom: 5 }}>Pending Invites</Text>
                        <FlatList
                            data={invites}
                            keyExtractor={item => item.id}
                            renderItem={renderInviteItem}
                            ListEmptyComponent={<Text style={{ fontStyle: 'italic', color: theme.colors.outline }}>No pending invites.</Text>}
                        />
                    </>
                )}
            </View>

            <FAB
                icon="plus"
                label="Invite Staff"
                style={{ position: 'absolute', margin: 16, right: 0, bottom: 0 }}
                onPress={() => router.push('/staff/add' as Href)}
            />
        </ScreenWrapper>
    );
};
