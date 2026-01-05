import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Dimensions, TextInput, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PieChart } from 'react-native-chart-kit';
import { api } from '../lib/api';
import { colors, spacing, fontSize, borderRadius } from '../lib/theme';
import type { Transaction } from '../lib/types';

// Palette for chart segments
const CHART_COLORS = [
  '#6366f1', // Indigo 500
  '#ec4899', // Pink 500
  '#8b5cf6', // Violet 500
  '#10b981', // Emerald 500
  '#f59e0b', // Amber 500
  '#3b82f6', // Blue 500
  '#ef4444', // Red 500
  '#14b8a6', // Teal 500
];

export default function BreakdownScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetCurrency, setTargetCurrency] = useState<'USD' | 'CRC'>('USD');
  const [exchangeRate, setExchangeRate] = useState('515');
  const [rateError, setRateError] = useState<string | null>(null);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setRateError(null);
      const data = await api.getTransactions();
      setTransactions(data);

      try {
        const rateData = await api.getExchangeRate();
        setExchangeRate(rateData.rate.toString());
      } catch (e: any) {
        console.error('Failed to load exchange rate', e);
        // If it's an API Error, show the message, otherwise generic
        setRateError(e.message || 'Failed to fetch rate');
      }
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoading(false);
    }
  };

  const processedData = useMemo(() => {
    const buckets: Record<string, number> = {};
    const rate = parseFloat(exchangeRate) || 515;
    let total = 0;

    transactions.forEach((txn) => {
      const category = txn.category || 'Uncategorized';
      let amount = txn.amount;

      // Convert amount to target currency
      if (txn.currency !== targetCurrency) {
        if (targetCurrency === 'CRC') {
          // USD -> CRC
          amount = amount * rate;
        } else {
          // CRC -> USD
          amount = amount / rate;
        }
      }

      buckets[category] = (buckets[category] || 0) + amount;
      total += amount;
    });

    const sortedBuckets = Object.entries(buckets)
      .map(([name, amount], index) => ({
        name,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
        legendFontColor: colors.textSecondary,
        legendFontSize: 12,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { buckets: sortedBuckets, total };
  }, [transactions, targetCurrency, exchangeRate]);

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: targetCurrency,
      minimumFractionDigits: 2,
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const screenWidth = Dimensions.get('window').width;
  // Sidebar is 240px, so effective width is screenWidth - 240 (on web) or simple width on mobile
  // For simplicity we'll just use a fixed max width or responsive calculation if likely on web
  const chartConfig = {
    backgroundGradientFrom: colors.background,
    backgroundGradientTo: colors.background,
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Spending Breakdown</Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.toggleGroup}>
          <Pressable
            style={[styles.toggleBtn, targetCurrency === 'USD' && styles.toggleBtnActive]}
            onPress={() => setTargetCurrency('USD')}
          >
            <Text style={[styles.toggleText, targetCurrency === 'USD' && styles.toggleTextActive]}>USD</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, targetCurrency === 'CRC' && styles.toggleBtnActive]}
            onPress={() => setTargetCurrency('CRC')}
          >
            <Text style={[styles.toggleText, targetCurrency === 'CRC' && styles.toggleTextActive]}>CRC</Text>
          </Pressable>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, rateError ? styles.errorText : null]}>
            {rateError ? 'Rate Error:' : 'Rate:'}
          </Text>
          <TextInput
            style={[styles.input, rateError ? styles.inputError : null]}
            value={exchangeRate}
            onChangeText={setExchangeRate}
            keyboardType="numeric"
            placeholder="515"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      </View>
      {rateError && (
        <Text style={styles.errorMessage}>
          {rateError} - using fallback
        </Text>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.chartContainer}>
           <PieChart
            data={processedData.buckets}
            width={screenWidth > 600 ? 500 : screenWidth - 48}
            height={220}
            chartConfig={chartConfig}
            accessor={'amount'}
            backgroundColor={'transparent'}
            paddingLeft={'15'}
            center={[10, 0]}
            absolute={false} 
            hasLegend={true}
          />
        </View>

        <View style={styles.totalContainer}>
             <Text style={styles.totalLabel}>Total Spent</Text>
             <Text style={styles.totalValue}>{formatAmount(processedData.total)}</Text>
        </View>

        <View style={styles.list}>
          {processedData.buckets.map((item) => (
            <View key={item.name} style={styles.item}>
              <View style={styles.row}>
                <View style={styles.labelRow}>
                   <View style={[styles.dot, { backgroundColor: item.color }]} />
                   <Text style={styles.categoryName} numberOfLines={1}>{item.name}</Text>
                </View>
                <Text style={styles.amount}>{formatAmount(item.amount)}</Text>
              </View>
              <View style={styles.barContainer}>
                <View 
                  style={[
                    styles.bar, 
                    { width: `${(item.amount / processedData.total) * 100}%`, backgroundColor: item.color }
                  ]} 
                />
              </View>
              <Text style={styles.percentage}>{item.percentage.toFixed(1)}%</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.xl * 1.5,
    fontWeight: '700',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.lg,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceHighlight,
    borderRadius: borderRadius.md,
    padding: 4,
  },
  toggleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  toggleBtnActive: {
    backgroundColor: colors.background, // or colors.primary based on look
  },
  toggleText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: colors.text,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  input: {
    backgroundColor: colors.surfaceHighlight,
    color: colors.text,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    minWidth: 60,
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  totalContainer: {
    marginBottom: spacing.lg,
    alignItems: 'center',    
  },
  totalLabel: {
    color: colors.textSecondary, 
    fontSize: fontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  totalValue: {
    color: colors.text,
    fontSize: fontSize.xxl,
    fontWeight: '700',
  },
  list: {
    // 
  },
  item: {
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  categoryName: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '500',
    flex: 1,
  },
  amount: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  barContainer: {
    height: 6,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  bar: {
    height: '100%',
    borderRadius: 3,
  },
  percentage: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    textAlign: 'right',
  },
  errorText: {
    color: colors.danger,
  },
  inputError: {
    borderColor: colors.danger,
    borderWidth: 1,
  },
  errorMessage: {
    color: colors.danger,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
  },
});
