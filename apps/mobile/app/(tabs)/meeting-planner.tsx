import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { expandRecurringMeetings, isMeetingPast } from '@pm/domain';
import type { Meeting } from '@pm/types';
import { useMeetings } from '../../src/hooks/useMeetings';
import { useContacts } from '../../src/hooks/useContacts';
import { MeetingCard } from '../../src/components/meetings/MeetingCard';
import { SkeletonList } from '../../src/components/ui';
import { MeetingDetailScreen } from '../../src/components/meetings/MeetingDetailScreen';
import { MeetingFormModal } from '../../src/components/meetings/MeetingFormModal';
import { colors } from '../../src/theme/colors';
import { borderRadius, spacing } from '../../src/theme/spacing';
import { fontSize, fontFamily } from '../../src/theme/typography';
import { todayISO, addDays } from '../../src/lib/dateUtils';

// ---- helpers ---------------------------------------------------------------

type Tab = 'upcoming' | 'past';

function buildLists(
  allMeetings: Meeting[],
  today: string,
): { upcoming: Meeting[]; past: Meeting[] } {
  const future90 = addDays(today, 90);
  const past90 = addDays(today, -90);

  // Upcoming: status=upcoming meetings, expanded over [today, today+90]
  const upcomingBase = allMeetings.filter((m) => m.status === 'upcoming');
  const upcoming = expandRecurringMeetings(upcomingBase, today, future90);

  // Past: meetings that are past (by time) OR have a terminal status
  const pastBase = allMeetings.filter(
    (m) => isMeetingPast(m) || m.status === 'completed' || m.status === 'missed' || m.status === 'cancelled',
  );
  // Expand in case any recurring meetings had past occurrences, then sort desc
  const pastExpanded = expandRecurringMeetings(pastBase, past90, today);
  const past = [...pastExpanded].sort((a, b) => b.start_at.localeCompare(a.start_at));

  return { upcoming, past };
}

// ---- component -------------------------------------------------------------

export default function MeetingPlannerScreen() {
  const today = todayISO();

  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);

  const { data: allMeetings = [], isLoading, refetch } = useMeetings();
  const [refreshing, setRefreshing] = useState(false);
  const { data: contacts = [] } = useContacts();

  const contactMap = useMemo(
    () => new Map(contacts.map((c) => [c.id, c.full_name])),
    [contacts],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const { upcoming, past } = useMemo(
    () => buildLists(allMeetings, today),
    [allMeetings, today],
  );

  const displayedMeetings = activeTab === 'upcoming' ? upcoming : past;

  // -- handlers ---------------------------------------------------------------

  const handleCardPress = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setDetailVisible(true);
  };

  const handleDetailClose = () => {
    setDetailVisible(false);
    setSelectedMeeting(null);
  };

  const handleDetailEdit = (meeting: Meeting) => {
    setDetailVisible(false);
    setEditMeeting(meeting);
    setFormVisible(true);
  };

  const handleAddPress = () => {
    setEditMeeting(null);
    setFormVisible(true);
  };

  const handleFormClose = () => {
    setFormVisible(false);
    setEditMeeting(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meetings</Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleAddPress}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented control */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'upcoming' && styles.tabBtnActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'upcoming' && styles.tabBtnTextActive]}>
            Upcoming
          </Text>
          {upcoming.length > 0 && (
            <View style={[styles.badge, activeTab === 'upcoming' ? styles.badgeActive : styles.badgeInactive]}>
              <Text style={[styles.badgeText, activeTab === 'upcoming' && styles.badgeTextActive]}>
                {upcoming.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'past' && styles.tabBtnActive]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'past' && styles.tabBtnTextActive]}>
            Past
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlashList
        data={displayedMeetings}
        estimatedItemSize={90}
        keyExtractor={(item) => `${item.id}-${item.date}`}
        renderItem={({ item }) => (
          <MeetingCard
            meeting={item}
            contactName={contactMap.get(item.linked_contact_id)}
            onPress={() => handleCardPress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        ListEmptyComponent={
          isLoading ? <SkeletonList count={4} /> : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {activeTab === 'upcoming' ? 'No upcoming meetings' : 'No past meetings'}
              </Text>
              {activeTab === 'upcoming' && (
                <TouchableOpacity onPress={handleAddPress}>
                  <Text style={styles.emptyLink}>Schedule a meeting</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Detail screen */}
      <MeetingDetailScreen
        meeting={selectedMeeting}
        contactName={selectedMeeting ? contactMap.get(selectedMeeting.linked_contact_id) : undefined}
        visible={detailVisible}
        onClose={handleDetailClose}
        onEdit={handleDetailEdit}
      />

      {/* Form modal */}
      <MeetingFormModal
        visible={formVisible}
        editMeeting={editMeeting}
        onClose={handleFormClose}
      />
    </SafeAreaView>
  );
}

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

  // Segmented control
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
    gap: spacing.sm,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  tabBtnActive: {
    backgroundColor: colors.blue[600],
  },
  tabBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.ink.light,
  },
  tabBtnTextActive: { color: '#FFFFFF' },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  badgeInactive: { backgroundColor: colors.blue[100] },
  badgeText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '700',
    color: colors.blue[600],
  },
  badgeTextActive: { color: '#FFFFFF' },

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
  },
  emptyLink: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '500',
    color: colors.blue[600],
  },
});
