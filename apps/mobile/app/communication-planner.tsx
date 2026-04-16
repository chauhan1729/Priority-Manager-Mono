import React, { useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  filterContactsByCategory,
  filterContactsBySearch,
  sortContacts,
  type ContactSortKey,
} from '@pm/domain';
import type { Contact, ContactCategory } from '@pm/types';
import { useContacts, useDeleteContact } from '../src/hooks/useContacts';
import { supabase } from '../src/lib/supabase/client';
import { useAuth } from '../src/components/providers/AuthProvider';
import {
  ContactCard,
  ContactDetailScreen,
  ContactFormModal,
} from '../src/components/communication';
import { SkeletonList } from '../src/components/ui';
import { colors } from '../src/theme/colors';
import { borderRadius, spacing } from '../src/theme/spacing';
import { fontSize, fontFamily } from '../src/theme/typography';

// ---------------------------------------------------------------------------
// Category filter chips
// ---------------------------------------------------------------------------

const CATEGORIES: { label: string; value: ContactCategory | 'all' }[] = [
  { label: 'All',          value: 'all' },
  { label: 'Personal',     value: 'personal' },
  { label: 'Professional', value: 'professional' },
  { label: 'Family',       value: 'family' },
  { label: 'Client',       value: 'client' },
  { label: 'Vendor',       value: 'vendor' },
  { label: 'Other',        value: 'other' },
];

const SORT_OPTIONS: { label: string; value: ContactSortKey }[] = [
  { label: 'Name',              value: 'name' },
  { label: 'Category',          value: 'category' },
  { label: 'Recently updated',  value: 'updated' },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function CommunicationPlannerScreen() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ContactCategory | 'all'>('all');
  const [sortKey, setSortKey] = useState<ContactSortKey>('name');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);

  const { data: allContacts = [], isLoading, refetch } = useContacts();
  const [refreshing, setRefreshing] = useState(false);

  // Look up live contact from the list so edits refresh the detail view
  const selectedContact = useMemo(
    () => (selectedContactId ? allContacts.find((c) => c.id === selectedContactId) ?? null : null),
    [allContacts, selectedContactId],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };
  const deleteMutation = useDeleteContact();

  const filteredContacts = useMemo(() => {
    let list = filterContactsByCategory(allContacts, activeCategory);
    list = filterContactsBySearch(list, search);
    return sortContacts(list, sortKey);
  }, [allContacts, activeCategory, search, sortKey]);

  // -- handlers ---------------------------------------------------------------

  const handleCardPress = (contact: Contact) => {
    setSelectedContactId(contact.id);
    setDetailVisible(true);
  };

  const handleDetailClose = () => {
    setDetailVisible(false);
    setSelectedContactId(null);
  };

  const handleDetailEdit = (contact: Contact) => {
    setDetailVisible(false);
    setEditContact(contact);
    setFormVisible(true);
  };

  const handleAddPress = () => {
    setEditContact(null);
    setFormVisible(true);
  };

  const handleSortPress = () => {
    const labels = SORT_OPTIONS.map((o) => o.label);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...labels],
          cancelButtonIndex: 0,
          title: 'Sort by',
        },
        (idx) => {
          if (idx > 0) setSortKey(SORT_OPTIONS[idx - 1]!.value);
        },
      );
    } else {
      Alert.alert('Sort by', undefined, [
        { text: 'Cancel', style: 'cancel' },
        ...SORT_OPTIONS.map((o) => ({
          text: o.label,
          onPress: () => setSortKey(o.value),
        })),
      ]);
    }
  };

  const activeSortLabel =
    SORT_OPTIONS.find((o) => o.value === sortKey)?.label ?? 'Name';

  const handleFormClose = () => {
    setFormVisible(false);
    setEditContact(null);
  };

  const handleLongPress = (contact: Contact) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            'Cancel',
            'Delete contact (keep history)',
            'Delete and unlink all tasks',
          ],
          destructiveButtonIndex: [1, 2],
          cancelButtonIndex: 0,
          title: contact.full_name,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) confirmDelete(contact, 'soft');
          if (buttonIndex === 2) confirmDelete(contact, 'unlink');
        },
      );
    } else {
      Alert.alert(
        contact.full_name,
        'Choose a delete option:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete (keep history)',
            style: 'destructive',
            onPress: () => confirmDelete(contact, 'soft'),
          },
          {
            text: 'Delete and unlink all tasks',
            style: 'destructive',
            onPress: () => confirmDelete(contact, 'unlink'),
          },
        ],
      );
    }
  };

  const confirmDelete = async (contact: Contact, mode: 'soft' | 'unlink') => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    // Fetch exact count of active delegated activities for accurate message
    let count = 0;
    if (user) {
      const { count: dbCount } = await supabase
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('delegated_contact_id', contact.id)
        .not('status', 'in', '(completed,cancelled)');
      count = dbCount ?? 0;
    }

    const plural = (n: number, s: string, p: string) => (n === 1 ? s : p);
    let message: string;
    if (count === 0) {
      message = `Delete ${contact.full_name}? No linked activities — the contact will be removed safely.`;
    } else if (mode === 'unlink') {
      message = `Delete ${contact.full_name} and unlink ${count} delegated ${plural(count, 'activity', 'activities')}? The ${plural(count, 'activity', 'activities')} will be preserved without a contact reference.`;
    } else {
      message = `Delete ${contact.full_name}? ${count} linked delegated ${plural(count, 'activity', 'activities')} will remain in history but lose the contact reference.`;
    }

    Alert.alert('Confirm Delete', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteMutation.mutate(
            { id: contact.id, mode },
            {
              onError: (e: Error) =>
                Alert.alert('Error', e.message),
            },
          ),
      },
    ]);
  };

  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Action bar */}
      <View style={styles.header}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.sortBtn} onPress={handleSortPress}>
          <Text style={styles.sortBtnText}>Sort: {activeSortLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={handleAddPress}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <RNTextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, company, email, notes…"
          placeholderTextColor={colors.gray[400]}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {/* Category filter chips */}
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.value;
            return (
              <TouchableOpacity
                key={cat.value}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setActiveCategory(cat.value)}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Contact list */}
      <FlashList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContactCard
            contact={item}
            onPress={() => handleCardPress(item)}
            onLongPress={() => handleLongPress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        ListEmptyComponent={
          isLoading ? <SkeletonList count={5} /> : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {search || activeCategory !== 'all'
                  ? 'No contacts match your filter.'
                  : 'No contacts yet.'}
              </Text>
              {!search && activeCategory === 'all' && (
                <TouchableOpacity onPress={handleAddPress}>
                  <Text style={styles.emptyLink}>Add your first contact</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Detail screen */}
      <ContactDetailScreen
        contact={selectedContact}
        visible={detailVisible}
        onClose={handleDetailClose}
        onEdit={handleDetailEdit}
      />

      {/* Create / Edit form */}
      <ContactFormModal
        visible={formVisible}
        editContact={editContact}
        onClose={handleFormClose}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize['2xl'],
    color: colors.ink.DEFAULT,
  },
  sortBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.blue[200],
    backgroundColor: colors.blue[50],
    marginRight: spacing.sm,
  },
  sortBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.blue[700],
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.blue[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '300',
  },

  // Search
  searchBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  searchInput: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
  },

  // Category filter
  filterRow: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  filterContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[300],
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    backgroundColor: colors.blue[600],
    borderColor: colors.blue[600],
  },
  filterChipText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.ink.light,
  },
  filterChipTextActive: { color: '#FFFFFF' },

  // List
  listContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing['3xl'],
  },

  // Empty state
  empty: {
    paddingTop: spacing['3xl'] * 2,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.gray[400],
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  emptyLink: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '500',
    color: colors.blue[600],
  },
});
