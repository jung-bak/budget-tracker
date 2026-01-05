import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';
import { api, ApiError } from '../lib/api';
import { colors, spacing, fontSize, borderRadius, shadows } from '../lib/theme';
import type { Transaction } from '../lib/types';
import {
  TransactionItem,
  StatsBar,
  ApiKeyModal,
  EditModal,
  DeleteModal,
  BackfillModal,
  Toast,
  ToastType,
} from '../components';

export default function HomeScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  // Filter States
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });

  // Filter Modals
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);

  // Modal states
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBackfillModal, setShowBackfillModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
    message: '',
    type: 'info',
    visible: false,
  });

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type, visible: true });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      const data = await api.getTransactions();
      // Sort by timestamp descending
      const sorted = data.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setTransactions(sorted);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setShowApiKeyModal(true);
      } else {
        showToast('Failed to load transactions', 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    const checkApiKeyAndLoad = async () => {
      const key = await api.getApiKey();
      if (!key) {
        setShowApiKeyModal(true);
        setLoading(false);
      } else {
        loadTransactions();
      }
    };
    checkApiKeyAndLoad();
  }, [loadTransactions]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const handleApiKeySubmit = async (key: string) => {
    await api.setApiKey(key);
    setShowApiKeyModal(false);
    setLoading(true);
    loadTransactions();
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await api.syncEmails();
      showToast(
        `Synced: ${result.processed} new, ${result.skipped} skipped, ${result.errors} errors`,
        result.errors > 0 ? 'error' : 'success'
      );
      loadTransactions();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setShowApiKeyModal(true);
      } else {
        showToast('Sync failed', 'error');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleBackfill = async (startDate: string, endDate: string) => {
    setBackfilling(true);
    try {
      const result = await api.backfill({ start_date: startDate, end_date: endDate });
      setShowBackfillModal(false);
      showToast(
        `Backfill: ${result.processed} new, ${result.skipped} skipped, ${result.errors} errors`,
        result.errors > 0 ? 'error' : 'success'
      );
      loadTransactions();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setShowApiKeyModal(true);
      } else {
        showToast('Backfill failed', 'error');
      }
    } finally {
      setBackfilling(false);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    if (selectionMode) return;
    setSelectedTransaction(transaction);
    setShowEditModal(true);
  };

  const handleEditSave = async (updated: Transaction) => {
    setEditLoading(true);
    try {
      const { global_id, ...data } = updated;
      await api.updateTransaction(global_id, data);
      setShowEditModal(false);
      setSelectedTransaction(null);
      showToast('Transaction updated', 'success');
      loadTransactions();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setShowApiKeyModal(true);
      } else {
        showToast('Update failed', 'error');
      }
    } finally {
      setEditLoading(false);
    }
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedIds(new Set());
  };

  const handleSelect = (transaction: Transaction) => {
    if (!selectionMode) return;
    
    const newSelected = new Set(selectedIds);
    if (newSelected.has(transaction.global_id)) {
      newSelected.delete(transaction.global_id);
    } else {
      newSelected.add(transaction.global_id);
    }
    setSelectedIds(newSelected);
  };

  const handleLongPress = (transaction: Transaction) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds(new Set([transaction.global_id]));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);
    try {
      if (selectedTransaction) {
         // Single delete (fallback or safety)
         await api.deleteTransaction(selectedTransaction.global_id);
      } else {
        // Bulk delete
        const promises = Array.from(selectedIds).map(id => api.deleteTransaction(id));
        await Promise.all(promises);
      }

      setShowDeleteModal(false);
      setSelectedTransaction(null);
      setSelectionMode(false);
      setSelectedIds(new Set());
      showToast('Transactions deleted', 'success');
      loadTransactions();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setShowApiKeyModal(true);
      } else {
        showToast('Delete failed', 'error');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filter Logic
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    transactions.forEach(t => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Category Filter
      if (filterCategory && t.category !== filterCategory) return false;
      
      // Date Range Filter
      if (dateRange.start) {
        const txnDate = t.timestamp.split('T')[0];
        if (txnDate < dateRange.start) return false;
        if (dateRange.end && txnDate > dateRange.end) return false;
      }
      return true;
    });
  }, [transactions, filterCategory, dateRange]);

  // Calendar Marking Logic
  const markedDates = useMemo(() => {
    const marks: any = {};
    if (dateRange.start) {
      marks[dateRange.start] = { startingDay: true, color: colors.primary, textColor: 'white' };
      if (dateRange.end) {
        marks[dateRange.end] = { endingDay: true, color: colors.primary, textColor: 'white' };
        
        // Mark all dates in between if possible, or just start/end for now.
        // A full implementation would loop from start to end.
      } else {
        marks[dateRange.start] = { selected: true, color: colors.primary, textColor: 'white' };
      }
    }
    return marks;
  }, [dateRange]);

  const onDayPress = (day: DateData) => {
    if (!dateRange.start || (dateRange.start && dateRange.end)) {
      // Start new range
      setDateRange({ start: day.dateString, end: null });
    } else {
      // Complete range
      // Ensure start is before end
      if (day.dateString < dateRange.start) {
         setDateRange({ start: day.dateString, end: dateRange.start });
      } else {
         setDateRange({ ...dateRange, end: day.dateString });
      }
    }
  };

  const getFilterSummary = () => {
    const parts = [];
    if (dateRange.start) {
      parts.push(dateRange.end ? `${dateRange.start} - ${dateRange.end}` : dateRange.start);
    }
    if (filterCategory) {
      parts.push(filterCategory);
    }
    return parts.length > 0 ? parts.join(' • ') : 'All Transactions';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading transactions...</Text>
        </View>
        <ApiKeyModal visible={showApiKeyModal} onSubmit={handleApiKeySubmit} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Action buttons */}
      <View style={styles.actions}>
        {selectionMode ? (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.cancelButton,
                pressed && styles.actionButtonPressed,
              ]}
              onPress={toggleSelectionMode}
            >
              <Text style={styles.cancelButtonText}>Cancel ({selectedIds.size})</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.deleteButton,
                pressed && styles.actionButtonPressed,
                selectedIds.size === 0 && styles.actionButtonDisabled,
              ]}
              onPress={handleDeleteSelected}
              disabled={selectedIds.size === 0}
            >
              <Text style={styles.deleteButtonText}>Delete Selected</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.syncButton,
                pressed && styles.actionButtonPressed,
                syncing && styles.actionButtonDisabled,
              ]}
              onPress={handleSync}
              disabled={syncing}
            >
              <Text style={styles.actionButtonText}>{syncing ? 'Syncing...' : 'Sync'}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.backfillButton,
                pressed && styles.actionButtonPressed,
              ]}
              onPress={() => setShowBackfillModal(true)}
            >
              <Text style={styles.actionButtonText}>Backfill</Text>
            </Pressable>
             <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.selectButton,
                pressed && styles.actionButtonPressed,
              ]}
              onPress={toggleSelectionMode}
            >
              <Text style={styles.selectButtonText}>Select</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Filter Stats Bar */}
      {!selectionMode && (
         <View style={styles.filterStatsBar}>
            <View style={styles.filterInfo}>
               <Text style={styles.filterInfoLabel}>Showing:</Text>
               <Text style={styles.filterInfoText}>{getFilterSummary()}</Text>
            </View>
            <View style={styles.filterButtons}>
               {/* Date Button */}
               <Pressable 
                  style={[styles.filterBtn, dateRange.start && styles.filterBtnActive]}
                  onPress={() => setShowDateModal(true)}
               >
                  <Text style={[styles.filterBtnText, dateRange.start && styles.filterBtnTextActive]}>Date</Text>
               </Pressable>
               {/* Category Button */}
               <Pressable 
                  style={[styles.filterBtn, filterCategory && styles.filterBtnActive]}
                  onPress={() => setShowCategoryModal(true)}
               >
                  <Text style={[styles.filterBtnText, filterCategory && styles.filterBtnTextActive]}>Category</Text>
               </Pressable>
                {/* Clear Button */}
               {(dateRange.start || filterCategory) && (
                 <Pressable 
                    style={styles.clearFilterBtn}
                    onPress={() => { setFilterCategory(null); setDateRange({start: null, end: null}); }}
                 >
                    <Text style={styles.clearFilterText}>×</Text>
                 </Pressable>
               )}
            </View>
         </View>
      )}

      {/* Stats */}
      <View style={styles.statsContainer}>
        <StatsBar transactions={filteredTransactions} />
      </View>

      {/* Table Header */}
      <View style={styles.tableHeader}>
        {selectionMode && <View style={{ width: 20 + 8 }} />} 
        <View style={styles.colDate}>
          <Text style={styles.headerText}>Date</Text>
        </View>
        <View style={styles.colMerchant}>
          <Text style={styles.headerText}>Merchant</Text>
        </View>
        <View style={styles.colCategory}>
          <Text style={styles.headerText}>Category</Text>
        </View>
        <View style={styles.colAmount}>
          <Text style={styles.headerText}>Amount</Text>
        </View>
      </View>

      {/* Transaction list */}
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.global_id}
        renderItem={({ item }) => (
          <TransactionItem
            transaction={item}
            onEdit={handleEdit}
            onSelect={handleSelect}
            onLongPress={handleLongPress}
            selectionMode={selectionMode}
            isSelected={selectedIds.has(item.global_id)}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No transactions found</Text>
            <Text style={styles.emptySubtext}>
               Try adjusting filters or syncing new data
            </Text>
          </View>
        }
      />

      {/* Modals */}
      <ApiKeyModal
        visible={showApiKeyModal}
        onSubmit={handleApiKeySubmit}
        showCancel={transactions.length > 0}
        onCancel={() => setShowApiKeyModal(false)}
      />

      <EditModal
        visible={showEditModal}
        transaction={selectedTransaction}
        onSave={handleEditSave}
        onCancel={() => {
          setShowEditModal(false);
          setSelectedTransaction(null);
        }}
        loading={editLoading}
      />

      <DeleteModal
        visible={showDeleteModal}
        transaction={selectedTransaction}
        count={selectedTransaction ? 1 : selectedIds.size}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedTransaction(null);
        }}
        loading={deleteLoading}
      />

      <BackfillModal
        visible={showBackfillModal}
        onSubmit={handleBackfill}
        onCancel={() => setShowBackfillModal(false)}
        loading={backfilling}
      />

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <Pressable 
           style={styles.modalOverlay}
           onPress={() => setShowCategoryModal(false)}
        >
          <View style={styles.dropdownModal}>
             <Text style={styles.modalTitle}>Select Category</Text>
             <ScrollView style={styles.categoryList}>
                <Pressable
                   style={[styles.categoryItem, !filterCategory && styles.categoryItemActive]}
                   onPress={() => { setFilterCategory(null); setShowCategoryModal(false); }}
                >
                   <Text style={[styles.categoryText, !filterCategory && styles.categoryTextActive]}>All Categories</Text>
                </Pressable>
                {uniqueCategories.map(cat => (
                   <Pressable
                      key={cat}
                      style={[styles.categoryItem, filterCategory === cat && styles.categoryItemActive]}
                      onPress={() => { setFilterCategory(cat); setShowCategoryModal(false); }}
                   >
                      <Text style={[styles.categoryText, filterCategory === cat && styles.categoryTextActive]}>{cat}</Text>
                   </Pressable>
                ))}
             </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Date Calendar Modal */}
      <Modal
        visible={showDateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateModal(false)}
      >
        <Pressable 
           style={styles.modalOverlay}
           onPress={() => setShowDateModal(false)}
        >
          <View style={styles.calendarModal}>
            <View style={styles.calendarHeader}>
              <Text style={styles.modalTitle}>Select Date Range</Text>
              {(dateRange.start || dateRange.end) && (
                 <Pressable onPress={() => setDateRange({start: null, end: null})}>
                   <Text style={styles.resetText}>Reset</Text>
                 </Pressable>
              )}
            </View>
            
            <Calendar
               onDayPress={onDayPress}
               markedDates={markedDates}
               markingType={'period'}
               theme={{
                 backgroundColor: colors.surface,
                 calendarBackground: colors.surface,
                 textSectionTitleColor: colors.textSecondary,
                 selectedDayBackgroundColor: colors.primary,
                 selectedDayTextColor: '#ffffff',
                 todayTextColor: colors.primary,
                 dayTextColor: colors.text,
                 textDisabledColor: '#444',
                 arrowColor: colors.primary,
                 monthTextColor: colors.text,
                 textDayFontWeight: '400',
                 textMonthFontWeight: '600',
                 textDayHeaderFontWeight: '600',
               }}
            />
            <Pressable 
               style={styles.closeBtn}
               onPress={() => setShowDateModal(false)}
            >
               <Text style={styles.closeBtnText}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>


      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={hideToast}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: spacing.md,
    fontSize: fontSize.md,
  },
  actions: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPressed: {
    opacity: 0.8,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  syncButton: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  backfillButton: {
    backgroundColor: colors.surfaceHighlight,
    // No border, just clean block
  },
  actionButtonText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  selectButton: {
    backgroundColor: colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectButtonText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  // Filter Bar New
  filterStatsBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterInfo: {
     flex: 1,
  },
  filterInfoLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  filterInfoText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterBtnText: {
    color: colors.text,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#fff',
  },
  clearFilterBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearFilterText: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 18,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dropdownModal: {
    width: '100%',
    maxWidth: 300,
    maxHeight: '60%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.lg,
  },
  calendarModal: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.lg,
  },
  modalTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  categoryList: {
    marginTop: spacing.sm,
  },
  categoryItem: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryItemActive: {
    backgroundColor: colors.surfaceHighlight,
  },
  categoryText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
  categoryTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  resetText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  closeBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  statsContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  // Table Header
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
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
  headerText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  list: {
    paddingBottom: spacing.xl,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
});
