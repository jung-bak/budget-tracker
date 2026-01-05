import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../lib/theme';
import type { Transaction } from '../lib/types';

interface DeleteModalProps {
  visible: boolean;
  transaction: Transaction | null;
  count?: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function DeleteModal({ visible, transaction, count = 0, onConfirm, onCancel, loading }: DeleteModalProps) {
  const formatAmount = (amount: number, currency: string) => {
    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return currency === 'USD' ? `$${formatted}` : `₡${formatted}`;
  };

  const isBulk = count > 1;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>
            {isBulk ? `Delete ${count} Transactions?` : 'Delete Transaction?'}
          </Text>

          {!isBulk && transaction && (
            <View style={styles.transactionInfo}>
              <Text style={styles.merchant}>{transaction.merchant}</Text>
              <Text style={styles.amount}>
                {formatAmount(transaction.amount, transaction.currency)}
              </Text>
            </View>
          )}

          {isBulk && (
            <Text style={styles.description}>
              You are about to delete {count} selected transactions. This action cannot be undone.
            </Text>
          )}

          {!isBulk && <Text style={styles.warning}>This action cannot be undone.</Text>}

          <View style={styles.buttons}>
            <Pressable
              style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.buttonPressed]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.deleteButton,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={onConfirm}
              disabled={loading}
            >
              <Text style={styles.deleteText}>{loading ? 'Deleting...' : 'Delete'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  transactionInfo: {
    backgroundColor: colors.surfaceHighlight, // Cleaner highlight
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  merchant: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  amount: {
    color: colors.danger,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  warning: {
    color: colors.warning,
    fontSize: fontSize.sm,
    marginBottom: spacing.lg,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  deleteText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  description: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
});
