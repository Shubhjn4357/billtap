import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LineChart, PieChart } from 'react-native-gifted-charts';

export default function ReportsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const lineData = [{value: 15}, {value: 30}, {value: 26}, {value: 40}];
  const pieData = [
      {value: 54, color: theme.colors.primary}, 
      {value: 40, color: theme.colors.secondary}, 
      {value: 6, color: theme.colors.tertiary}
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 20 }}>
        <Text variant="headlineMedium" style={{ fontWeight: 'bold', marginBottom: 20 }}>Analytics</Text>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">Sales Trend</Text>
            <View style={{ marginTop: 20 }}>
               <LineChart 
                  data={lineData} 
                  color={theme.colors.primary} 
                  thickness={3}
                  hideRules
                  hideYAxisText
                  hideAxesAndRules
                  curved
                  height={150}
                  width={280}
              />
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">Category Distribution</Text>
            <View style={{ marginTop: 20, alignItems: 'center' }}>
               <PieChart 
                  data={pieData} 
                  donut
                  radius={80}
                  innerRadius={60}
              />
            </View>
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { marginBottom: 20, borderRadius: 16 }
});
