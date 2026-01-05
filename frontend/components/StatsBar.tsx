import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../lib/theme';
import type { Transaction } from '../lib/types';

interface StatsBarProps {
  transactions: Transaction[];
}

export function StatsBar({ transactions }: StatsBarProps) {
  const stats = transactions.reduce(
    (acc, txn) => {
      if (txn.currency === 'USD') {
        acc.usd += txn.amount;
      } else if (txn.currency === 'CRC') {
        acc.crc += txn.amount;
      }
      return acc;
    },
    { usd: 0, crc: 0 }
  );

  const formatAmount = (amount: number, currency: string) => {
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return currency === 'USD' ? `$${formatted}` : `₡${formatted}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.stat}>
        <Text style={styles.label}>Transactions</Text>
        <Text style={styles.value}>{transactions.length}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.stat}>
        <Text style={styles.label}>USD Total</Text>
        <Text style={[styles.value, styles.usd]}>{formatAmount(stats.usd, 'USD')}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.stat}>
        <Text style={styles.label}>CRC Total</Text>
        <Text style={[styles.value, styles.crc]}>{formatAmount(stats.crc, 'CRC')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg, // Sleek radius
    padding: spacing.md,
    marginBottom: spacing.md,
    // Minimalist border
    borderWidth: 1,
    borderColor: colors.border,
    // Add subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  value: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  usd: {
    color: colors.success,
  },
  crc: {
    color: colors.primary,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
});
