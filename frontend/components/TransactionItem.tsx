import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../lib/theme';
import type { Transaction } from '../lib/types';

interface TransactionItemProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onSelect?: (transaction: Transaction) => void;
  onLongPress?: (transaction: Transaction) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 48,
  },
  selectedContainer: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)', // colors.primary with opacity
  },
  pressed: {
    backgroundColor: colors.surfaceHighlight,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  // Columns
  colDate: {
    width: 80,
    marginRight: spacing.sm,
  },
  colMerchant: {
    flex: 2,
    marginRight: spacing.sm,
  },
  colCategory: {
    flex: 1,
    marginRight: spacing.sm,
    alignItems: 'flex-start',
  },
  colAmount: {
    width: 90,
    alignItems: 'flex-end',
  },
  // Text Styles
  dateText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  merchantText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  notesText: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontStyle: 'italic',
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceHighlight,
  },
  categoryText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
  },
  amountText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});

export function TransactionItem({
  transaction,
  onEdit,
  onSelect,
  onLongPress,
  selectionMode = false,
  isSelected = false,
}: TransactionItemProps) {
  const formatAmount = (amount: number, currency: string) => {
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return currency === 'USD' ? `$${formatted}` : `₡${formatted}`;
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handlePress = () => {
    if (selectionMode) {
      onSelect?.(transaction);
    } else {
      onEdit(transaction);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={() => onLongPress?.(transaction)}
      style={({ pressed }) => [
        styles.container,
        isSelected && styles.selectedContainer,
        pressed && !selectionMode && styles.pressed,
      ]}
    >
      {selectionMode && (
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <View style={styles.checkmark} />}
        </View>
      )}

      {/* Date Column */}
      <View style={styles.colDate}>
        <Text style={styles.dateText}>{formatDate(transaction.timestamp)}</Text>
      </View>

      {/* Merchant Column */}
      <View style={styles.colMerchant}>
        <Text style={styles.merchantText} numberOfLines={1}>
          {transaction.merchant}
        </Text>
        {transaction.notes ? (
           <Text style={styles.notesText} numberOfLines={1}>{transaction.notes}</Text>
        ) : null}
      </View>

      {/* Category Column */}
      <View style={styles.colCategory}>
        {transaction.category ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText} numberOfLines={1}>
              {transaction.category}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Amount Column */}
      <View style={styles.colAmount}>
        <Text style={styles.amountText}>
          {formatAmount(transaction.amount, transaction.currency)}
        </Text>
      </View>
    </Pressable>
  );
}
