import React, { useEffect, useRef } from 'react';
import { Modal, StyleSheet, TouchableWithoutFeedback, View, Animated } from 'react-native';
import { Text, useTheme, Divider, Drawer, IconButton } from 'react-native-paper';
import { TransactionType } from '../../../types';
import { DesignSystem } from '../../../constants/DesignSystem';

interface BillingDrawerProps {
    visible: boolean;
    onDismiss: () => void;
    transactionType: TransactionType;
    onSelectType: (type: TransactionType) => void;
    isGstBill: boolean;
    onToggleGst: (enabled: boolean) => void;
}

export const BillingDrawer = ({
    visible,
    onDismiss,
    transactionType,
    onSelectType,
    isGstBill,
    onToggleGst,
}: BillingDrawerProps) => {
    const theme = useTheme();

    const slideAnim = useRef(new Animated.Value(-300)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                speed: 20,
                bounciness: 0,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: -320,
                duration: DesignSystem.motion.fast,
                useNativeDriver: true,
            }).start();
        }
    }, [visible, slideAnim]);

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
            <View style={styles.overlay}>
                <TouchableWithoutFeedback onPress={onDismiss}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>
                <Animated.View
                    style={[
                        styles.drawerContainer,
                        { backgroundColor: theme.colors.surface, transform: [{ translateX: slideAnim }] }
                    ]}
                >
                    <View style={styles.header}>
                        <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>Billing Mode</Text>
                        <IconButton icon="close" onPress={onDismiss} />
                    </View>
                    <Divider />

                    <View style={styles.content}>
                        <Drawer.Section title="Transaction Type">
                            <Drawer.Item
                                label="Sale Bill"
                                icon="receipt"
                                active={transactionType === 'SALE'}
                                onPress={() => { onSelectType('SALE'); onDismiss(); }}
                            />
                            <Drawer.Item
                                label="Purchase Entry"
                                icon="cart-arrow-down"
                                active={transactionType === 'PURCHASE'}
                                onPress={() => { onSelectType('PURCHASE'); onDismiss(); }}
                            />
                            <Drawer.Item
                                label="Return Inward (Sales)"
                                icon="keyboard-return"
                                active={transactionType === 'RETURN_INWARD'}
                                onPress={() => { onSelectType('RETURN_INWARD'); onDismiss(); }}
                            />
                            <Drawer.Item
                                label="Return Outward (Purchase)"
                                icon="truck-fast"
                                active={transactionType === 'RETURN_OUTWARD'}
                                onPress={() => { onSelectType('RETURN_OUTWARD'); onDismiss(); }}
                            />
                        </Drawer.Section>

                        <Drawer.Section title="Bill Format">
                            <Drawer.Item
                                label="GST Invoice"
                                icon="file-document-outline"
                                active={isGstBill === true}
                                onPress={() => { onToggleGst(true); onDismiss(); }}
                            />
                            <Drawer.Item
                                label="Estimate / Non-GST"
                                icon="file-outline"
                                active={isGstBill === false}
                                onPress={() => { onToggleGst(false); onDismiss(); }}
                            />
                        </Drawer.Section>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        flexDirection: 'row',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    drawerContainer: {
        width: 300,
        height: '100%',
        maxWidth: '85%',
        elevation: 16,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: DesignSystem.spacing.md,
        paddingTop: DesignSystem.spacing.xl,
    },
    content: {
        flex: 1,
    }
});
