import React, { ReactElement } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useTheme } from 'react-native-paper';

export interface AppPullToRefreshProps {
    refreshing: boolean;
    onRefresh: () => void | Promise<void>;
    children: ReactElement<any, any>;
}

export const AppPullToRefresh: React.FC<AppPullToRefreshProps> = ({ refreshing, onRefresh, children }) => {
    const theme = useTheme();

    // Since children is expected to be a ScrollView like component, we clone it and add RefreshControl.
    // If it's already a ScrollView or FlatList, we inject RefreshControl.
    const isScrollable = children?.type === ScrollView || (children?.props && children.props.contentContainerStyle);

    if (isScrollable) {
        return React.cloneElement(children, {
            refreshControl: (
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={[theme.colors.primary]}
                    tintColor={theme.colors.primary}
                />
            ),
        });
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={[theme.colors.primary]}
                    tintColor={theme.colors.primary}
                />
            }
        >
            {children}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    content: {
        flexGrow: 1,
    },
});
