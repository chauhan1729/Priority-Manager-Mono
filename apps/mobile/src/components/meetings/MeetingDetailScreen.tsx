import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  isMeetingPast,
  isMeetingRunning,
  needsStatusUpdatePrompt,
  needsTakeawayPrompt,
} from '@pm/domain';
import type { Meeting, MeetingStatus } from '@pm/types';
import {
  useArchiveMeeting,
  useDeleteMeeting,
  useUpdateMeeting,
} from '../../hooks/useMeetings';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// ---- types -----------------------------------------------------------------

interface Props {
  meeting: Meeting | null;
  contactName?: string | undefined;
  contactSubtitle?: string | undefined;
  contactEmail?: string | null;
  contactPhone?: string | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (meeting: Meeting) => void; // open MeetingFormModal for full edit
}

// ---- helpers ---------------------------------------------------------------

const STATUS_OPTIONS: MeetingStatus[] = ['upcoming', 'completed', 'missed', 'cancelled'];

const STATUS_STYLE: Record<MeetingStatus, { bg: string; text: string }> = {
  upcoming: { bg: colors.blue[50], text: colors.blue[600] },
  completed: { bg: colors.green[50], text: colors.green[700] },
  missed: { bg: colors.red[50], text: colors.red[600] },
  cancelled: { bg: colors.gray[100], text: colors.gray[500] },
};

function formatDateTime(isoDatetime: string): string {
  return new Date(isoDatetime).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---- component -------------------------------------------------------------

export function MeetingDetailScreen({
  meeting,
  contactName,
  contactSubtitle,
  contactEmail,
  contactPhone,
  visible,
  onClose,
  onEdit,
}: Props) {
  const [takeaways, setTakeaways] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<MeetingStatus>('upcoming');
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const updateMutation = useUpdateMeeting();
  const deleteMutation = useDeleteMeeting();
  const archiveMutation = useArchiveMeeting();

  // Sync form when meeting changes
  useEffect(() => {
    if (meeting) {
      setTakeaways(meeting.key_takeaways ?? '');
      setSelectedStatus(meeting.status);
      setError(null);
      setSaveState('idle');
    }
  }, [meeting]);

  const isPast = meeting ? isMeetingPast(meeting) : false;
  const running = meeting ? isMeetingRunning(meeting) : false;
  const needsTakeaway = meeting ? needsTakeawayPrompt(meeting) : false;
  const needsStatusUpdate = meeting ? needsStatusUpdatePrompt(meeting) : false;

  const handleContactPress = () => {
    onClose();
    router.push('/communication-planner');
  };

  const handleEmailPress = () => {
    if (contactEmail) Linking.openURL(`mailto:${contactEmail}`);
  };

  const handlePhonePress = () => {
    if (contactPhone) Linking.openURL(`tel:${contactPhone}`);
  };

  // -- actions ----------------------------------------------------------------

  const handleSaveTakeaways = useCallback(() => {
    if (!meeting) return;
    setSaveState('saving');
    setError(null);
    updateMutation.mutate(
      {
        id: meeting.id,
        key_takeaways: takeaways.trim() || null,
        status: selectedStatus,
      },
      {
        onSuccess: () => setSaveState('saved'),
        onError: (e) => { setError((e as Error).message); setSaveState('idle'); },
      },
    );
  }, [meeting, takeaways, selectedStatus, updateMutation]);

  const handleDelete = useCallback(() => {
    if (!meeting) return;
    Alert.alert(
      'Delete Meeting',
      `Delete "${meeting.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteMutation.mutate(
              { meetingId: meeting.id },
              { onSuccess: onClose },
            ),
        },
      ],
    );
  }, [meeting, deleteMutation, onClose]);

  const handleArchive = useCallback(() => {
    if (!meeting) return;
    Alert.alert('Archive Meeting', 'Archive this meeting? It will be hidden from the list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        onPress: () =>
          archiveMutation.mutate(
            { meetingId: meeting.id },
            { onSuccess: onClose },
          ),
      },
    ]);
  }, [meeting, archiveMutation, onClose]);

  if (!meeting) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Meeting Detail
          </Text>
          {/* Edit button — only for future meetings */}
          {!isPast ? (
            <TouchableOpacity onPress={() => onEdit(meeting)}>
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerPlaceholder} />
          )}
        </View>

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Takeaway prompt banner */}
          {needsTakeaway && (
            <View style={styles.takeawayBanner}>
              <Text style={styles.takeawayBannerText}>
                This meeting has ended — add key takeaways below.
              </Text>
            </View>
          )}

          {/* Status update prompt */}
          {needsStatusUpdate && (
            <View style={styles.statusUpdateBanner}>
              <Text style={styles.statusUpdateBannerText}>
                This meeting has passed. Update its status.
              </Text>
            </View>
          )}

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Title */}
          <View style={styles.section}>
            <View style={styles.titleRow}>
              <Text style={styles.meetingTitle}>{meeting.title}</Text>
              {running && (
                <View style={styles.inProgressBadge}>
                  <Text style={styles.inProgressBadgeText}>In progress</Text>
                </View>
              )}
            </View>
            {contactName && (
              <TouchableOpacity onPress={handleContactPress} activeOpacity={0.7}>
                <Text style={styles.contactName}>
                  {contactName}
                  {contactSubtitle ? ` · ${contactSubtitle}` : ''}
                  {'  ›'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Contact info (email / phone) — tappable */}
          {(contactEmail || contactPhone) && (
            <View style={styles.contactInfoBlock}>
              {contactEmail && (
                <TouchableOpacity style={styles.contactInfoRow} onPress={handleEmailPress}>
                  <Text style={styles.contactInfoLabel}>Email</Text>
                  <Text style={styles.contactInfoValueLink} numberOfLines={1}>{contactEmail}</Text>
                </TouchableOpacity>
              )}
              {contactPhone && (
                <TouchableOpacity style={styles.contactInfoRow} onPress={handlePhonePress}>
                  <Text style={styles.contactInfoLabel}>Phone</Text>
                  <Text style={styles.contactInfoValueLink} numberOfLines={1}>{contactPhone}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Meta */}
          <View style={styles.metaBlock}>
            <MetaRow label="Start" value={formatDateTime(meeting.start_at)} />
            <MetaRow label="End" value={formatDateTime(meeting.end_at)} />
            <MetaRow label="Duration" value={`${meeting.duration_minutes} min`} />
            {meeting.recurrence_rule && (
              <MetaRow label="Recurs" value={meeting.recurrence_rule} />
            )}
          </View>

          {/* Agenda (read-only for past, editable for future via Edit) */}
          {meeting.agenda ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Agenda</Text>
              <Text style={styles.agendaText}>{meeting.agenda}</Text>
            </View>
          ) : null}

          {/* Status selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Status</Text>
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map((s) => {
                const ss = STATUS_STYLE[s];
                const isActive = selectedStatus === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.statusChip,
                      { borderColor: ss.text },
                      isActive && { backgroundColor: ss.bg },
                    ]}
                    onPress={() => setSelectedStatus(s)}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        { color: isActive ? ss.text : colors.gray[400] },
                      ]}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Key Takeaways (always editable) */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Key Takeaways</Text>
            <RNTextInput
              style={styles.takeawaysInput}
              value={takeaways}
              onChangeText={(v) => { setTakeaways(v); setSaveState('idle'); }}
              placeholder="Decisions made, action items, outcomes…"
              placeholderTextColor={colors.gray[400]}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Save takeaways/status */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.saveBtn, saveState === 'saving' && styles.saveBtnDisabled]}
              onPress={handleSaveTakeaways}
              disabled={saveState === 'saving'}
            >
              <Text style={styles.saveBtnText}>
                {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Save Takeaways & Status'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Secondary actions */}
          <View style={styles.actionsSection}>
            <TouchableOpacity style={styles.archiveBtn} onPress={handleArchive}>
              <Text style={styles.archiveBtnText}>Archive</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Text style={styles.deleteBtnText}>
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FAFAF8' },
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.ink.DEFAULT,
    marginHorizontal: spacing.sm,
  },
  closeText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.gray[500],
  },
  editText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.blue[600],
  },
  headerPlaceholder: { width: 36 },
  scroll: { flex: 1 },

  // Banners
  takeawayBanner: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.amber[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.amber[200],
  },
  takeawayBannerText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.amber[700],
  },
  statusUpdateBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.blue[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.blue[200],
  },
  statusUpdateBannerText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.blue[600],
  },
  errorBox: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.red[50],
    borderRadius: borderRadius.md,
  },
  errorText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.red[600],
  },

  // Content
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  meetingTitle: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.ink.DEFAULT,
  },
  inProgressBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    backgroundColor: colors.amber[500],
  },
  inProgressBadgeText: {
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  contactName: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.blue[600],
  },
  contactInfoBlock: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[100],
  },
  contactInfoRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  contactInfoLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[400],
    width: 56,
  },
  contactInfoValueLink: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.blue[600],
  },
  metaBlock: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    marginVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.gray[100],
  },
  metaRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    gap: spacing.sm,
  },
  metaLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[400],
    width: 72,
  },
  metaValue: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.DEFAULT,
  },
  sectionLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.gray[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  agendaText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.DEFAULT,
    lineHeight: 20,
    backgroundColor: colors.gray[50],
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },

  // Status chips
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  statusChipText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '500',
    textTransform: 'capitalize',
  },

  // Takeaways
  takeawaysInput: {
    borderWidth: 1,
    borderColor: colors.blue[200],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.DEFAULT,
    minHeight: 100,
    lineHeight: 20,
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
  },

  // Buttons
  saveBtn: {
    backgroundColor: colors.blue[600],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionsSection: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing['3xl'],
  },
  archiveBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[300],
    alignItems: 'center',
  },
  archiveBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.gray[600],
  },
  deleteBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.red[50],
    borderWidth: 1,
    borderColor: colors.red[200],
    alignItems: 'center',
  },
  deleteBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.red[600],
  },
});
