import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, useTheme, FAB } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../../../store';
import { BarChart, PieChart } from 'react-native-gifted-charts';

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useUserStore();

  const barData = [
    { value: 250, label: 'M' },
    { value: 500, label: 'T' },
    { value: 745, label: 'W' },
    { value: 320, label: 'T' },
    { value: 600, label: 'F' },
    { value: 256, label: 'S' },
    { value: 300, label: 'S' },
  ];

  const pieData = [
    { value: 54, color: '#177AD5', text: '54%' },
    { value: 40, color: '#79D2DE', text: '30%' },
    { value: 20, color: '#ED6665', text: '26%' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <Text variant="headlineMedium" style={{ fontWeight: 'bold' }}>
            Welcome, {user?.displayName || 'User'}
          </Text>
          <Text variant="titleMedium" style={{ color: theme.colors.secondary }}>
            {user?.businessName || 'Business Name'}
          </Text>
        </View>

        <View style={styles.summaryContainer}>
          <Card style={[styles.card, { backgroundColor: theme.colors.primaryContainer }]}>
             <Card.Content>
                <Text variant="labelLarge">Total Sales</Text>
                <Text variant="displaySmall" style={{ fontWeight: 'bold' }}>₹ 12,500</Text>
             </Card.Content>
          </Card>
          
           <Card style={[styles.card, { backgroundColor: theme.colors.secondaryContainer }]}>
             <Card.Content>
                <Text variant="labelLarge">Orders</Text>
                <Text variant="displaySmall" style={{ fontWeight: 'bold' }}>45</Text>
             </Card.Content>
          </Card>
        </View>

        <View style={styles.chartContainer}>
           <Text variant="titleLarge" style={{ marginBottom: 15, paddingHorizontal: 20 }}>Weekly Sales</Text>
           <View style={{ paddingHorizontal: 20 }}>
              <BarChart
                data={barData}
                barWidth={22}
                noOfSections={3}
                barBorderRadius={4}
                frontColor={theme.colors.primary}
                yAxisThickness={0}
                xAxisThickness={0}
                xAxisLabelTextStyle={{ color: theme.colors.onSurfaceVariant }}
              />
           </View>
        </View>

        <View style={styles.chartContainer}>
           <Text variant="titleLarge" style={{ marginBottom: 15, paddingHorizontal: 20 }}>Top Categories</Text>
           <View style={{ alignItems: 'center' }}>
              <PieChart
                data={pieData}
                donut
                showText
                textColor="black"
                radius={120}
                innerRadius={60}
                textSize={14}
                focusOnPress
              />
           </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  card: {
    flex: 0.48,
    borderRadius: 16,
  },
  chartContainer: {
    marginBottom: 30,
  }
});
