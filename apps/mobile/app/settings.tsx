import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../src/lib/supabase/client';
import { useAuth } from '../src/components/providers/AuthProvider';
import {
  useProfile,
  useReminderPreferences,
  useUpdateProfile,
  useUpdateReminderPreferences,
} from '../src/hooks/useSettings';
import { colors } from '../src/theme/colors';
import { borderRadius, spacing } from '../src/theme/spacing';
import { fontSize, fontFamily } from '../src/theme/typography';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEETING_REMINDER_OPTIONS = [5, 10, 15, 30, 60];
const BIRTHDAY_REMINDER_OPTIONS = [0, 1, 3, 7];
const TRAVEL_REMINDER_OPTIONS = [0, 1, 3, 7];
const RENEWAL_REMINDER_OPTIONS = [0, 1, 3, 7];

// Common IANA timezones for the picker
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
  'UTC',
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const { user: authUser } = useAuth();
  const { data: prefs } = useReminderPreferences();
  const { data: profile } = useProfile();

  const updatePrefs = useUpdateReminderPreferences();
  const updateProfile = useUpdateProfile();

  // Local state for prefs (optimistic)
  const [morningSummaryEnabled, setMorningSummaryEnabled] = useState(true);
  const [morningSummaryTime, setMorningSummaryTime] = useState('08:00');
  const [eodEnabled, setEodEnabled] = useState(true);
  const [eodTime, setEodTime] = useState('21:00');
  const [meetingMinutes, setMeetingMinutes] = useState(10);
  const [birthdayDays, setBirthdayDays] = useState(1);
  const [travelDays, setTravelDays] = useState(1);
  const [renewalDays, setRenewalDays] = useState(1);

  // Timezone
  const [timezone, setTimezone] = useState('UTC');
  const [tzPickerVisible, setTzPickerVisible] = useState(false);
  const [tzSearch, setTzSearch] = useState('');

  // Populate from fetched data
  useEffect(() => {
    if (prefs) {
      setMorningSummaryEnabled(prefs.morning_summary_enabled);
      setMorningSummaryTime(prefs.morning_summary_time);
      setEodEnabled(prefs.eod_review_enabled);
      setEodTime(prefs.eod_review_time);
      setMeetingMinutes(prefs.meeting_reminder_minutes_before);
      setBirthdayDays(prefs.birthday_reminder_days_before);
      setTravelDays(prefs.travel_reminder_days_before);
      setRenewalDays(prefs.renewal_reminder_days_before);
    }
  }, [prefs]);

  useEffect(() => {
    if (profile?.timezone) setTimezone(profile.timezone);
  }, [profile]);

  // ---------------------------------------------------------------------------
  // Persist helpers
  // ---------------------------------------------------------------------------

  const savePrefs = (patch: Parameters<typeof updatePrefs.mutate>[0]) => {
    updatePrefs.mutate(patch, {
      onError: (e: Error) => Alert.alert('Error', e.message),
    });
  };

  const saveTimezone = (tz: string) => {
    setTimezone(tz);
    updateProfile.mutate({ timezone: tz }, {
      onError: (e: Error) => Alert.alert('Error', e.message),
    });
  };

  // ---------------------------------------------------------------------------
  // Sign out
  // ---------------------------------------------------------------------------

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/login' as never);
        },
      },
    ]);
  };

  // ---------------------------------------------------------------------------
  // Timezone search
  // ---------------------------------------------------------------------------

  const filteredTimezones = useMemo(() => {
    if (!tzSearch.trim()) return TIMEZONES;
    const q = tzSearch.toLowerCase();
    return TIMEZONES.filter((tz) => tz.toLowerCase().includes(q));
  }, [tzSearch]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ---------------------------------------------------------------- */}
        {/* Notifications section                                            */}
        {/* ---------------------------------------------------------------- */}

        <SectionHeader title="Notifications" />

        {/* Morning Summary */}
        <View style={styles.group}>
          <View style={styles.toggleRow}>
            <Text style={styles.rowLabel}>Morning Summary</Text>
            <Switch
              value={morningSummaryEnabled}
              onValueChange={(v) => {
                setMorningSummaryEnabled(v);
                savePrefs({ morning_summary_enabled: v });
              }}
              trackColor={{ false: colors.gray[200], true: colors.blue[400] }}
              thumbColor="#FFFFFF"
            />
          </View>
          {morningSummaryEnabled && (
            <TimePickerRow
              label="Time"
              value={morningSummaryTime}
              onChange={(t) => {
                setMorningSummaryTime(t);
                savePrefs({ morning_summary_time: t });
              }}
            />
          )}
        </View>

        {/* End-of-Day Review */}
        <View style={styles.group}>
          <View style={styles.toggleRow}>
            <Text style={styles.rowLabel}>End-of-Day Review</Text>
            <Switch
              value={eodEnabled}
              onValueChange={(v) => {
                setEodEnabled(v);
                savePrefs({ eod_review_enabled: v });
              }}
              trackColor={{ false: colors.gray[200], true: colors.blue[400] }}
              thumbColor="#FFFFFF"
            />
          </View>
          {eodEnabled && (
            <TimePickerRow
              label="Time"
              value={eodTime}
              onChange={(t) => {
                setEodTime(t);
                savePrefs({ eod_review_time: t });
              }}
            />
          )}
        </View>

        {/* Meeting Reminder */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Meeting Reminder</Text>
          <OptionPickerRow
            label="Minutes before"
            options={MEETING_REMINDER_OPTIONS}
            value={meetingMinutes}
            format={(v) => `${v} min`}
            onSelect={(v) => {
              setMeetingMinutes(v);
              savePrefs({ meeting_reminder_minutes_before: v });
            }}
          />
        </View>

        {/* Birthday Reminder */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Birthday Reminder</Text>
          <OptionPickerRow
            label="Days before"
            options={BIRTHDAY_REMINDER_OPTIONS}
            value={birthdayDays}
            format={(v) => (v === 0 ? 'Same day' : `${v} day${v > 1 ? 's' : ''} before`)}
            onSelect={(v) => {
              setBirthdayDays(v);
              savePrefs({ birthday_reminder_days_before: v });
            }}
          />
        </View>

        {/* Travel Reminder */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Travel Reminder</Text>
          <OptionPickerRow
            label="Days before"
            options={TRAVEL_REMINDER_OPTIONS}
            value={travelDays}
            format={(v) => (v === 0 ? 'Same day' : `${v} day${v > 1 ? 's' : ''} before`)}
            onSelect={(v) => {
              setTravelDays(v);
              savePrefs({ travel_reminder_days_before: v });
            }}
          />
        </View>

        {/* Renewal Reminder */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Renewal Reminder</Text>
          <OptionPickerRow
            label="Days before"
            options={RENEWAL_REMINDER_OPTIONS}
            value={renewalDays}
            format={(v) => (v === 0 ? 'Same day' : `${v} day${v > 1 ? 's' : ''} before`)}
            onSelect={(v) => {
              setRenewalDays(v);
              savePrefs({ renewal_reminder_days_before: v });
            }}
          />
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* Display section                                                  */}
        {/* ---------------------------------------------------------------- */}

        <SectionHeader title="Display" />

        <View style={styles.group}>
          <TouchableOpacity
            style={styles.plainRow}
            onPress={() => { setTzSearch(''); setTzPickerVisible(true); }}
          >
            <Text style={styles.rowLabel}>Timezone</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{timezone}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ---------------------------------------------------------------- */}
        {/* Account section                                                  */}
        {/* ---------------------------------------------------------------- */}

        <SectionHeader title="Account" />

        <View style={styles.group}>
          <View style={styles.plainRow}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValueMuted} numberOfLines={1}>
              {authUser?.email ?? '—'}
            </Text>
          </View>
        </View>

        <View style={styles.group}>
          <TouchableOpacity style={styles.signOutRow} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Timezone picker modal */}
      <Modal
        visible={tzPickerVisible}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setTzPickerVisible(false)}
      >
        <View style={styles.tzModal}>
          <View style={styles.tzHeader}>
            <Text style={styles.tzHeaderTitle}>Select Timezone</Text>
            <TouchableOpacity onPress={() => setTzPickerVisible(false)}>
              <Text style={styles.tzDone}>Done</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.tzSearchBox}>
            <TextInput
              style={styles.tzSearchInput}
              value={tzSearch}
              onChangeText={setTzSearch}
              placeholder="Search…"
              placeholderTextColor={colors.gray[400]}
              autoFocus
              clearButtonMode="while-editing"
            />
          </View>
          <ScrollView>
            {filteredTimezones.map((tz) => (
              <TouchableOpacity
                key={tz}
                style={[styles.tzItem, timezone === tz && styles.tzItemActive]}
                onPress={() => {
                  saveTimezone(tz);
                  setTzPickerVisible(false);
                }}
              >
                <Text style={[styles.tzItemText, timezone === tz && styles.tzItemTextActive]}>
                  {tz}
                </Text>
                {timezone === tz && <Text style={styles.tzCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>
  );
}

function TimePickerRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string; // "HH:MM"
  onChange: (value: string) => void;
}) {
  const [hour, minute] = value.split(':').map(Number);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];

  return (
    <View style={styles.timePickerRow}>
      <Text style={styles.rowSubLabel}>{label}</Text>
      <View style={styles.timePickerControls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {hours.map((h) => (
            <TouchableOpacity
              key={h}
              style={[styles.timeChip, hour === h && styles.timeChipActive]}
              onPress={() => onChange(`${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)}
            >
              <Text style={[styles.timeChipText, hour === h && styles.timeChipTextActive]}>
                {String(h).padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={styles.timeSep}>:</Text>
        <View style={styles.minuteRow}>
          {minutes.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.timeChip, minute === m && styles.timeChipActive]}
              onPress={() => onChange(`${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`)}
            >
              <Text style={[styles.timeChipText, minute === m && styles.timeChipTextActive]}>
                {String(m).padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

function OptionPickerRow<T extends number>({
  label,
  options,
  value,
  format,
  onSelect,
}: {
  label: string;
  options: T[];
  value: T;
  format: (v: T) => string;
  onSelect: (v: T) => void;
}) {
  return (
    <View style={styles.optionRow}>
      <Text style={styles.rowSubLabel}>{label}</Text>
      <View style={styles.optionChips}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.optionChip, value === opt && styles.optionChipActive]}
            onPress={() => onSelect(opt)}
          >
            <Text style={[styles.optionChipText, value === opt && styles.optionChipTextActive]}>
              {format(opt)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },

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
  backBtn: { minWidth: 70 },
  backBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.blue[600],
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize['2xl'],
    color: colors.ink.DEFAULT,
    textAlign: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing['3xl'] * 2 },

  // Section headers
  sectionHeader: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.gray[500],
    letterSpacing: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xs,
  },

  // Groups (iOS settings card style)
  group: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.blue[50],
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  groupLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.gray[500],
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Row types
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  plainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
    fontWeight: '500',
  },
  rowValue: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.gray[500],
    flexShrink: 1,
  },
  rowValueMuted: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.gray[400],
    flexShrink: 1,
  },
  rowSubLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[500],
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  chevron: {
    fontFamily: fontFamily.sans,
    fontSize: 18,
    color: colors.gray[400],
  },

  // Time picker
  timePickerRow: {
    paddingBottom: spacing.md,
  },
  timePickerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  timeSep: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.gray[400],
    marginHorizontal: 2,
  },
  minuteRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  timeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[200],
    marginRight: 4,
  },
  timeChipActive: {
    borderColor: colors.blue[600],
    backgroundColor: colors.blue[50],
  },
  timeChipText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[600],
  },
  timeChipTextActive: {
    color: colors.blue[700],
    fontWeight: '700',
  },

  // Option picker
  optionRow: {
    paddingBottom: spacing.md,
  },
  optionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  optionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: '#FFFFFF',
  },
  optionChipActive: {
    borderColor: colors.blue[600],
    backgroundColor: colors.blue[50],
  },
  optionChipText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[600],
  },
  optionChipTextActive: {
    color: colors.blue[700],
    fontWeight: '600',
  },

  // Sign out
  signOutRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  signOutText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.red[600],
  },

  // Timezone modal
  tzModal: { flex: 1, backgroundColor: '#FAFAF8' },
  tzHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  tzHeaderTitle: {
    flex: 1,
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize['2xl'],
    color: colors.ink.DEFAULT,
  },
  tzDone: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.blue[600],
  },
  tzSearchBox: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[50],
  },
  tzSearchInput: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tzItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[50],
    backgroundColor: '#FFFFFF',
  },
  tzItemActive: { backgroundColor: colors.blue[50] },
  tzItemText: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
  },
  tzItemTextActive: { color: colors.blue[700], fontWeight: '600' },
  tzCheck: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.blue[600],
    fontWeight: '700',
  },
});
