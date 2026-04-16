import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { isMeetingPast } from '@pm/domain';
import type { Contact, ContactCategory } from '@pm/types';
import { useUpdateContactNote } from '../../hooks/useContacts';
import { useMeetingsForContact } from '../../hooks/useMeetings';
import { useActivitiesForContact } from '../../hooks/useActivities';
import { MeetingFormModal } from '../meetings/MeetingFormModal';
import { DelegatedActivityFormModal } from './DelegatedActivityFormModal';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// ---------------------------------------------------------------------------
// Category badge config
// ---------------------------------------------------------------------------

const CATEGORY_STYLE: Record<ContactCategory, { bg: string; text: string; label: string }> = {
  personal:     { bg: colors.purple[100], text: colors.purple[700], label: 'Personal' },
  professional: { bg: colors.blue[100],   text: colors.blue[700],   label: 'Professional' },
  family:       { bg: colors.green[100],  text: colors.green[700],  label: 'Family' },
  client:       { bg: colors.amber[100],  text: colors.amber[700],  label: 'Client' },
  vendor:       { bg: colors.gray[100],   text: colors.gray[600],   label: 'Vendor' },
  other:        { bg: colors.gray[100],   text: colors.gray[600],   label: 'Other' },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  contact: Contact | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (contact: Contact) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContactDetailScreen({ contact, visible, onClose, onEdit }: Props) {
  const [note, setNote] = useState('');
  const [meetingFormVisible, setMeetingFormVisible] = useState(false);
  const [delegatedFormVisible, setDelegatedFormVisible] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateNote = useUpdateContactNote();

  const { data: meetings = [] } = useMeetingsForContact(contact?.id ?? '');
  const { data: delegatedActivities = [] } = useActivitiesForContact(contact?.id ?? '');

  // Sync note when contact changes
  useEffect(() => {
    if (contact) setNote(contact.note ?? '');
  }, [contact?.id, contact?.note]);

  // Auto-save note with 1s debounce
  const handleNoteChange = useCallback(
    (text: string) => {
      setNote(text);
      if (!contact) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateNote.mutate({ id: contact.id, note: text });
      }, 1000);
    },
    [contact, updateNote],
  );

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Derive next upcoming meeting and recent past meetings
  const nextMeeting = useMemo(() => {
    return meetings
      .filter((m) => !isMeetingPast(m) && m.status === 'upcoming')
      .sort((a, b) => a.start_at.localeCompare(b.start_at))[0];
  }, [meetings]);

  const recentMeetings = useMemo(() => {
    return meetings
      .filter((m) => isMeetingPast(m))
      .sort((a, b) => b.start_at.localeCompare(a.start_at))
      .slice(0, 3);
  }, [meetings]);

  if (!contact) return null;

  const cat = CATEGORY_STYLE[contact.category] ?? CATEGORY_STYLE.other;

  const navigateToMeetings = () => {
    onClose();
    router.push('/meeting-planner');
  };

  const navigateToActivities = () => {
    onClose();
    router.push('/(tabs)/activities');
  };

  const handleCallPress = () => {
    if (contact.phone) Linking.openURL(`tel:${contact.phone}`);
  };

  const handleEmailPress = () => {
    if (contact.email) Linking.openURL(`mailto:${contact.email}`);
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.headerBack}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {contact.full_name}
          </Text>
          <TouchableOpacity onPress={() => onEdit(contact)}>
            <Text style={styles.headerEdit}>Edit</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Info section */}
          <View style={styles.card}>
            <View style={styles.infoNameRow}>
              <View style={styles.avatarLg}>
                <Text style={styles.avatarLgText}>
                  {contact.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.infoNameBody}>
                <Text style={styles.infoName}>{contact.full_name}</Text>
                <View style={[styles.catBadge, { backgroundColor: cat.bg }]}>
                  <Text style={[styles.catBadgeText, { color: cat.text }]}>{cat.label}</Text>
                </View>
              </View>
            </View>

            {(contact.role || contact.company) && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Role</Text>
                <Text style={styles.infoValue}>
                  {[contact.role, contact.company].filter(Boolean).join(' · ')}
                </Text>
              </View>
            )}

            {contact.phone && (
              <TouchableOpacity style={styles.infoRow} onPress={handleCallPress}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={[styles.infoValue, styles.tappableValue]}>{contact.phone}</Text>
              </TouchableOpacity>
            )}

            {contact.email && (
              <TouchableOpacity style={styles.infoRow} onPress={handleEmailPress}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={[styles.infoValue, styles.tappableValue]}>{contact.email}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Rolling notes */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Notes</Text>
            {updateNote.isPending && (
              <Text style={styles.savingIndicator}>Saving…</Text>
            )}
          </View>
          <View style={styles.card}>
            <RNTextInput
              style={styles.noteInput}
              value={note}
              onChangeText={handleNoteChange}
              placeholder="Add notes about this contact…"
              placeholderTextColor={colors.gray[400]}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Quick actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setMeetingFormVisible(true)}
            >
              <Text style={styles.actionBtnText}>+ Schedule Meeting</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={() => setDelegatedFormVisible(true)}
            >
              <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>
                + Add Delegated Task
              </Text>
            </TouchableOpacity>
          </View>

          {/* Next meeting */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Next Meeting</Text>
          </View>
          {nextMeeting ? (
            <TouchableOpacity
              style={[styles.card, styles.nextMeetingCard]}
              onPress={navigateToMeetings}
              activeOpacity={0.75}
            >
              <Text style={styles.meetingTitle} numberOfLines={1}>{nextMeeting.title}</Text>
              <Text style={styles.meetingMeta}>
                {new Date(nextMeeting.start_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                {' · '}
                {new Date(nextMeeting.start_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                {' · '}
                {nextMeeting.duration_minutes} min
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.card, styles.emptyCard]}>
              <Text style={styles.emptyCardText}>No upcoming meetings with this contact.</Text>
            </View>
          )}

          {/* Recent past meetings */}
          {recentMeetings.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Meetings</Text>
              </View>
              {recentMeetings.map((meeting) => {
                const dateLabel = new Date(meeting.date + 'T00:00:00').toLocaleDateString(
                  undefined,
                  { weekday: 'short', month: 'short', day: 'numeric' },
                );
                return (
                  <TouchableOpacity
                    key={meeting.id}
                    style={[styles.card, styles.meetingCard]}
                    onPress={navigateToMeetings}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.meetingTitle} numberOfLines={1}>
                      {meeting.title}
                    </Text>
                    <Text style={styles.meetingMeta}>
                      {dateLabel} · {meeting.duration_minutes} min · {meeting.status}
                    </Text>
                    {meeting.key_takeaways ? (
                      <Text style={styles.meetingTakeaways} numberOfLines={2}>
                        {meeting.key_takeaways}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* Delegated activities */}
          {delegatedActivities.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Delegated Tasks · {delegatedActivities.length}
                </Text>
              </View>
              {delegatedActivities.map((activity) => {
                const dateLabel = new Date(activity.activity_date + 'T00:00:00').toLocaleDateString(
                  undefined,
                  { month: 'short', day: 'numeric' },
                );
                return (
                  <TouchableOpacity
                    key={activity.id}
                    style={[styles.card, styles.activityCard]}
                    onPress={navigateToActivities}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.activityTitle} numberOfLines={2}>
                      {activity.title}
                    </Text>
                    <Text style={styles.activityMeta}>
                      Due {dateLabel} · {activity.estimated_minutes} min · {activity.status.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      </Modal>

      {/* Schedule meeting — pre-selects current contact */}
      <MeetingFormModal
        visible={meetingFormVisible}
        initialContactId={contact.id}
        initialContactName={contact.full_name}
        onClose={() => setMeetingFormVisible(false)}
      />

      {/* Add delegated activity */}
      <DelegatedActivityFormModal
        visible={delegatedFormVisible}
        contactId={contact.id}
        contactName={contact.full_name}
        onClose={() => setDelegatedFormVisible(false)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
    backgroundColor: '#FFFFFF',
  },
  headerBack: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.blue[600],
    minWidth: 60,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.ink.DEFAULT,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  headerEdit: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.blue[600],
    minWidth: 60,
    textAlign: 'right',
  },
  scroll: { flex: 1, backgroundColor: '#FAFAF8' },
  scrollContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing['3xl'],
  },

  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.blue[100],
    padding: spacing.md,
  },
  meetingCard: { gap: 4 },
  activityCard: { gap: 4 },
  nextMeetingCard: {
    gap: 4,
    borderColor: colors.blue[300],
    backgroundColor: colors.blue[50],
  },
  emptyCard: {
    alignItems: 'center',
  },
  emptyCardText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[400],
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.gray[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  savingIndicator: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[400],
  },

  // Info section
  infoNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatarLg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.blue[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLgText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.blue[700],
  },
  infoNameBody: {
    flex: 1,
    gap: spacing.xs,
  },
  infoName: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.ink.DEFAULT,
  },
  catBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  catBadgeText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    gap: spacing.md,
  },
  infoLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[400],
    width: 48,
    flexShrink: 0,
  },
  infoValue: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.DEFAULT,
  },
  tappableValue: {
    color: colors.blue[600],
  },

  // Notes
  noteInput: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
    minHeight: 100,
    textAlignVertical: 'top',
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.blue[600],
    alignItems: 'center',
  },
  actionBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.blue[200],
  },
  actionBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionBtnTextSecondary: {
    color: colors.blue[600],
  },

  // Meeting history
  meetingTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.ink.DEFAULT,
  },
  meetingMeta: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.ink.light,
    textTransform: 'capitalize',
  },
  meetingTakeaways: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[500],
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Delegated activities
  activityTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.ink.DEFAULT,
  },
  activityMeta: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.ink.light,
    textTransform: 'capitalize',
  },
});
