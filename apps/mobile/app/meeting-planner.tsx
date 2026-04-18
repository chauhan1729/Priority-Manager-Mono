import React, { useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  expandRecurringMeetings,
  isMeetingPast,
  needsStatusUpdatePrompt,
  needsTakeawayPrompt,
} from '@pm/domain';
import type { Contact, Meeting } from '@pm/types';
import {
  useMeetings,
  useArchivedMeetings,
  useUnarchiveMeeting,
} from '../src/hooks/useMeetings';
import { useContacts } from '../src/hooks/useContacts';
import { MeetingCard } from '../src/components/meetings/MeetingCard';
import { SkeletonList } from '../src/components/ui';
import { MeetingDetailScreen } from '../src/components/meetings/MeetingDetailScreen';
import { MeetingFormModal } from '../src/components/meetings/MeetingFormModal';
import { colors } from '../src/theme/colors';
import { borderRadius, spacing } from '../src/theme/spacing';
import { fontSize, fontFamily } from '../src/theme/typography';
import { todayISO, addDays } from '../src/lib/dateUtils';

// ---- helpers ---------------------------------------------------------------

type Tab = 'upcoming' | 'past' | 'archived';

function buildLists(
  allMeetings: Meeting[],
  today: string,
): { upcoming: Meeting[]; past: Meeting[]; attentionCount: number } {
  const future90 = addDays(today, 90);
  const past90 = addDays(today, -90);

  // Upcoming: status=upcoming meetings, expanded over [today, today+90]
  const upcomingBase = allMeetings.filter((m) => m.status === 'upcoming');
  const upcomingExpanded = expandRecurringMeetings(upcomingBase, today, future90);

  // Dedupe by meeting.id — show only the next occurrence of each recurring meeting
  // (matches web MeetingPlannerView behavior)
  const seen = new Set<string>();
  const upcoming = upcomingExpanded
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

  // Past: meetings that are past (by time) OR have a terminal status
  const pastBase = allMeetings.filter(
    (m) => isMeetingPast(m) || m.status === 'completed' || m.status === 'missed' || m.status === 'cancelled',
  );
  // Expand so recurring past occurrences show individually, then sort desc
  const pastExpanded = expandRecurringMeetings(pastBase, past90, today);
  const past = [...pastExpanded].sort((a, b) => b.start_at.localeCompare(a.start_at));

  // Attention: past meetings needing a status update or takeaway
  const attentionCount = past.filter(
    (m) => needsStatusUpdatePrompt(m) || needsTakeawayPrompt(m),
  ).length;

  return { upcoming, past, attentionCount };
}

function buildContactSubtitle(contact: Contact | undefined): string | undefined {
  if (!contact) return undefined;
  const parts = [contact.role, contact.company].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

// ---- component -------------------------------------------------------------

export default function MeetingPlannerScreen() {
  const today = todayISO();

  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [selectedOccurrence, setSelectedOccurrence] = useState<{
    date: string;
    startAt: string;
    endAt: string;
  } | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);

  const { data: allMeetings = [], isLoading, refetch } = useMeetings();
  const { data: archivedMeetings = [], isLoading: isLoadingArchived, refetch: refetchArchived } =
    useArchivedMeetings();
  const unarchiveMutation = useUnarchiveMeeting();
  const [refreshing, setRefreshing] = useState(false);
  const { data: contacts = [] } = useContacts();

  const contactMap = useMemo(
    () => new Map(contacts.map((c) => [c.id, c] as const)),
    [contacts],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'archived') {
      await refetchArchived();
    } else {
      await refetch();
    }
    setRefreshing(false);
  };

  const { upcoming, past, attentionCount } = useMemo(
    () => buildLists(allMeetings, today),
    [allMeetings, today],
  );

  const sortedArchived = useMemo(
    () => [...archivedMeetings].sort((a, b) => b.start_at.localeCompare(a.start_at)),
    [archivedMeetings],
  );

  const displayedMeetings =
    activeTab === 'upcoming' ? upcoming : activeTab === 'past' ? past : sortedArchived;

  // Live-lookup selected meeting by id so detail reflects post-save state.
  // For recurring meetings, we want the base template (not the expanded occurrence),
  // so prefer allMeetings lookup first, then fall back to the expanded lists.
  const selectedMeeting = useMemo(() => {
    if (!selectedMeetingId) return null;
    return (
      allMeetings.find((m) => m.id === selectedMeetingId) ??
      [...upcoming, ...past, ...sortedArchived].find((m) => m.id === selectedMeetingId) ??
      null
    );
  }, [selectedMeetingId, allMeetings, upcoming, past, sortedArchived]);

  const selectedContact = selectedMeeting
    ? contactMap.get(selectedMeeting.linked_contact_id)
    : undefined;

  // -- handlers ---------------------------------------------------------------

  const handleCardPress = (meeting: Meeting) => {
    setSelectedMeetingId(meeting.id);
    // For recurring occurrences (upcoming tab), record the specific occurrence date/times
    // so per-instance actions can create a one-time record and advance the series.
    if (meeting.recurrence_rule && activeTab === 'upcoming') {
      setSelectedOccurrence({
        date: meeting.date,
        startAt: meeting.start_at,
        endAt: meeting.end_at,
      });
    } else {
      setSelectedOccurrence(null);
    }
    setDetailVisible(true);
  };

  const handleDetailClose = () => {
    setDetailVisible(false);
    setSelectedMeetingId(null);
    setSelectedOccurrence(null);
  };

  const handleDetailEdit = (meeting: Meeting) => {
    setDetailVisible(false);
    setSelectedOccurrence(null);
    setEditMeeting(meeting);
    setFormVisible(true);
  };

  const handleAddPress = () => {
    setEditMeeting(null);
    setFormVisible(true);
  };

  const handleUnarchive = (meeting: Meeting) => {
    Alert.alert('Unarchive Meeting', `Restore "${meeting.title}" to your active list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unarchive',
        onPress: () => unarchiveMutation.mutate({ meetingId: meeting.id }),
      },
    ]);
  };

  const handleFormClose = () => {
    setFormVisible(false);
    setEditMeeting(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Action bar */}
      <View style={styles.header}>
        <View style={{ flex: 1 }} />
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
          {attentionCount > 0 && (
            <View style={styles.attentionBadge}>
              <Text style={styles.attentionBadgeText}>{attentionCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'archived' && styles.tabBtnActive]}
          onPress={() => setActiveTab('archived')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'archived' && styles.tabBtnTextActive]}>
            Archived
          </Text>
          {sortedArchived.length > 0 && (
            <View style={[styles.badge, activeTab === 'archived' ? styles.badgeActive : styles.badgeInactive]}>
              <Text style={[styles.badgeText, activeTab === 'archived' && styles.badgeTextActive]}>
                {sortedArchived.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlashList
        data={displayedMeetings}
        keyExtractor={(item) => `${item.id}-${item.date}`}
        renderItem={({ item }) => {
          const c = contactMap.get(item.linked_contact_id);
          return (
            <View>
              <MeetingCard
                meeting={item}
                contactName={c?.full_name}
                contactSubtitle={buildContactSubtitle(c)}
                onPress={() => handleCardPress(item)}
              />
              {activeTab === 'archived' && (
                <View style={styles.unarchiveRow}>
                  <TouchableOpacity
                    style={styles.unarchiveBtn}
                    onPress={() => handleUnarchive(item)}
                  >
                    <Text style={styles.unarchiveBtnText}>Unarchive</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        ListEmptyComponent={
          (activeTab === 'archived' ? isLoadingArchived : isLoading) ? (
            <SkeletonList count={4} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {activeTab === 'upcoming'
                  ? 'No upcoming meetings'
                  : activeTab === 'past'
                  ? 'No past meetings'
                  : 'No archived meetings'}
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
        occurrence={selectedOccurrence}
        contactName={selectedContact?.full_name}
        contactSubtitle={buildContactSubtitle(selectedContact)}
        contactEmail={selectedContact?.email ?? null}
        contactPhone={selectedContact?.phone ?? null}
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
  attentionBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: colors.amber[500],
  },
  attentionBadgeText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Unarchive
  unarchiveRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    marginTop: -spacing.xs,
  },
  unarchiveBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.blue[300],
    backgroundColor: colors.blue[50],
  },
  unarchiveBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.blue[700],
  },

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
