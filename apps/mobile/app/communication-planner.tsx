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
} from '@pm/domain';
import type { Contact, ContactCategory } from '@pm/types';
import { useContacts, useDeleteContact } from '../src/hooks/useContacts';
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

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function CommunicationPlannerScreen() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ContactCategory | 'all'>('all');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);

  const { data: allContacts = [], isLoading, refetch } = useContacts();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };
  const deleteMutation = useDeleteContact();

  const filteredContacts = useMemo(() => {
    let list = filterContactsByCategory(allContacts, activeCategory);
    list = filterContactsBySearch(list, search);
    return sortContacts(list, 'name');
  }, [allContacts, activeCategory, search]);

  // -- handlers ---------------------------------------------------------------

  const handleCardPress = (contact: Contact) => {
    setSelectedContact(contact);
    setDetailVisible(true);
  };

  const handleDetailClose = () => {
    setDetailVisible(false);
    setSelectedContact(null);
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

  const confirmDelete = (contact: Contact, mode: 'soft' | 'unlink') => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const message =
      mode === 'unlink'
        ? `Delete ${contact.full_name} and unlink all delegated tasks? Tasks will be kept but no longer assigned to this contact.`
        : `Delete ${contact.full_name}? Their meeting and activity history will be preserved.`;

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
        estimatedItemSize={76}
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
