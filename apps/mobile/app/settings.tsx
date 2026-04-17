import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { supabase } from '../src/lib/supabase/client';
import { useAuth } from '../src/components/providers/AuthProvider';
import {
  useProfile,
  useReminderPreferences,
  useUpdateProfile,
  useUpdateReminderPreferences,
} from '../src/hooks/useSettings';
import { useNotifications } from '../src/components/providers/NotificationProvider';
import { TimePickerField } from '../src/components/ui/TimePickerField';
import {
  getNotificationSound,
  NOTIFICATION_SOUND_KEY,
  NOTIFICATION_SOUND_LABELS,
  type NotificationSound,
} from '../src/lib/notifications/mobile-notifications';
import { colors } from '../src/theme/colors';
import { borderRadius, spacing } from '../src/theme/spacing';
import { fontSize, fontFamily } from '../src/theme/typography';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOTIFICATION_SOUND_OPTIONS: NotificationSound[] = [
  'default', 'ding', 'chime', 'ping', 'alert', 'gentle', 'none',
];

const MEETING_REMINDER_OPTIONS = [0, 5, 10, 15, 30, 60];
const ACTIVITY_REMINDER_OPTIONS = [0, 2, 5, 10, 15, 30];
const EVENT_REMINDER_OPTIONS = [0, 5, 10, 15, 30, 60];
const BIRTHDAY_REMINDER_OPTIONS = [0, 1, 3, 7];
const TRAVEL_REMINDER_OPTIONS = [0, 1, 3, 7];
const RENEWAL_REMINDER_OPTIONS = [0, 1, 3, 7];

// IANA timezones — mirrors apps/web/src/components/settings/ReminderSettingsView.tsx
const TIMEZONES: { value: string; label: string }[] = [
  { value: 'UTC', label: 'UTC — Coordinated Universal Time' },
  // Africa
  { value: 'Africa/Abidjan', label: 'Africa/Abidjan (GMT+0)' },
  { value: 'Africa/Cairo', label: 'Africa/Cairo (EET, UTC+2)' },
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST, UTC+2)' },
  { value: 'Africa/Lagos', label: 'Africa/Lagos (WAT, UTC+1)' },
  { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT, UTC+3)' },
  // Americas
  { value: 'America/Anchorage', label: 'America/Anchorage (AKST, UTC-9)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'America/Buenos_Aires (ART, UTC-3)' },
  { value: 'America/Bogota', label: 'America/Bogota (COT, UTC-5)' },
  { value: 'America/Caracas', label: 'America/Caracas (VET, UTC-4)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST, UTC-6)' },
  { value: 'America/Denver', label: 'America/Denver (MST, UTC-7)' },
  { value: 'America/Halifax', label: 'America/Halifax (AST, UTC-4)' },
  { value: 'America/Lima', label: 'America/Lima (PET, UTC-5)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST, UTC-8)' },
  { value: 'America/Mexico_City', label: 'America/Mexico_City (CST, UTC-6)' },
  { value: 'America/New_York', label: 'America/New_York (EST, UTC-5)' },
  { value: 'America/Phoenix', label: 'America/Phoenix (MST, UTC-7, no DST)' },
  { value: 'America/Santiago', label: 'America/Santiago (CLT, UTC-4)' },
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (BRT, UTC-3)' },
  { value: 'America/Toronto', label: 'America/Toronto (EST, UTC-5)' },
  { value: 'America/Vancouver', label: 'America/Vancouver (PST, UTC-8)' },
  // Asia
  { value: 'Asia/Baghdad', label: 'Asia/Baghdad (AST, UTC+3)' },
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (ICT, UTC+7)' },
  { value: 'Asia/Colombo', label: 'Asia/Colombo (IST, UTC+5:30)' },
  { value: 'Asia/Dhaka', label: 'Asia/Dhaka (BST, UTC+6)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST, UTC+4)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong (HKT, UTC+8)' },
  { value: 'Asia/Jakarta', label: 'Asia/Jakarta (WIB, UTC+7)' },
  { value: 'Asia/Karachi', label: 'Asia/Karachi (PKT, UTC+5)' },
  { value: 'Asia/Kathmandu', label: 'Asia/Kathmandu (NPT, UTC+5:45)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, UTC+5:30)' },
  { value: 'Asia/Kuala_Lumpur', label: 'Asia/Kuala_Lumpur (MYT, UTC+8)' },
  { value: 'Asia/Manila', label: 'Asia/Manila (PST, UTC+8)' },
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh (AST, UTC+3)' },
  { value: 'Asia/Seoul', label: 'Asia/Seoul (KST, UTC+9)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST, UTC+8)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT, UTC+8)' },
  { value: 'Asia/Taipei', label: 'Asia/Taipei (CST, UTC+8)' },
  { value: 'Asia/Tehran', label: 'Asia/Tehran (IRST, UTC+3:30)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST, UTC+9)' },
  // Atlantic
  { value: 'Atlantic/Reykjavik', label: 'Atlantic/Reykjavik (GMT+0)' },
  // Australia / Pacific
  { value: 'Australia/Adelaide', label: 'Australia/Adelaide (ACST, UTC+9:30)' },
  { value: 'Australia/Brisbane', label: 'Australia/Brisbane (AEST, UTC+10)' },
  { value: 'Australia/Melbourne', label: 'Australia/Melbourne (AEST, UTC+10)' },
  { value: 'Australia/Perth', label: 'Australia/Perth (AWST, UTC+8)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST, UTC+10)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST, UTC+12)' },
  { value: 'Pacific/Honolulu', label: 'Pacific/Honolulu (HST, UTC-10)' },
  // Europe
  { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam (CET, UTC+1)' },
  { value: 'Europe/Athens', label: 'Europe/Athens (EET, UTC+2)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET, UTC+1)' },
  { value: 'Europe/Brussels', label: 'Europe/Brussels (CET, UTC+1)' },
  { value: 'Europe/Bucharest', label: 'Europe/Bucharest (EET, UTC+2)' },
  { value: 'Europe/Copenhagen', label: 'Europe/Copenhagen (CET, UTC+1)' },
  { value: 'Europe/Dublin', label: 'Europe/Dublin (GMT+0)' },
  { value: 'Europe/Helsinki', label: 'Europe/Helsinki (EET, UTC+2)' },
  { value: 'Europe/Istanbul', label: 'Europe/Istanbul (TRT, UTC+3)' },
  { value: 'Europe/Lisbon', label: 'Europe/Lisbon (WET, UTC+0)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST, UTC+0/+1)' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid (CET, UTC+1)' },
  { value: 'Europe/Moscow', label: 'Europe/Moscow (MSK, UTC+3)' },
  { value: 'Europe/Oslo', label: 'Europe/Oslo (CET, UTC+1)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET, UTC+1)' },
  { value: 'Europe/Rome', label: 'Europe/Rome (CET, UTC+1)' },
  { value: 'Europe/Stockholm', label: 'Europe/Stockholm (CET, UTC+1)' },
  { value: 'Europe/Vienna', label: 'Europe/Vienna (CET, UTC+1)' },
  { value: 'Europe/Warsaw', label: 'Europe/Warsaw (CET, UTC+1)' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich (CET, UTC+1)' },
];

// ---------------------------------------------------------------------------
// Helpers: HH:MM ↔ Date (TimePickerField uses Date; DB stores "HH:MM")
// ---------------------------------------------------------------------------

function hhmmToDate(hhmm: string | null | undefined): Date {
  const safe = hhmm && /^\d{2}:\d{2}/.test(hhmm) ? hhmm : '00:00';
  const [h, m] = safe.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

function dateToHhmm(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SettingsScreen() {
  const { user: authUser } = useAuth();
  const { data: prefs, isLoading: prefsLoading } = useReminderPreferences();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { reschedule } = useNotifications();

  const updatePrefs = useUpdateReminderPreferences();
  const updateProfile = useUpdateProfile();

  // Local state — edited values, distinct from server state
  const [morningSummaryEnabled, setMorningSummaryEnabled] = useState(true);
  const [morningSummaryTime, setMorningSummaryTime] = useState('08:00');
  const [eodEnabled, setEodEnabled] = useState(true);
  const [eodTime, setEodTime] = useState('21:00');
  const [meetingMinutes, setMeetingMinutes] = useState(15);
  const [birthdayDays, setBirthdayDays] = useState(1);
  const [travelDays, setTravelDays] = useState(1);
  const [renewalDays, setRenewalDays] = useState(3);
  const [activityStartingEnabled, setActivityStartingEnabled] = useState(true);
  const [activityMinutes, setActivityMinutes] = useState(5);
  const [activityOverdueEnabled, setActivityOverdueEnabled] = useState(true);
  const [eventMinutes, setEventMinutes] = useState(15);
  const [timezone, setTimezone] = useState('UTC');
  const [notificationSound, setNotificationSound] = useState<NotificationSound>('default');
  // Track the value last persisted to AsyncStorage so dirty check works.
  const savedSoundRef = useRef<NotificationSound>('default');

  // Timezone picker UI state
  const [tzPickerVisible, setTzPickerVisible] = useState(false);
  const [tzSearch, setTzSearch] = useState('');

  // Hydrate local state from server whenever server data arrives or changes.
  // Using JSON.stringify for dep to re-run after a successful save re-fetches.
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
      setActivityStartingEnabled(prefs.activity_starting_enabled ?? true);
      setActivityMinutes(prefs.activity_reminder_minutes_before ?? 5);
      setActivityOverdueEnabled(prefs.activity_overdue_enabled ?? true);
      setEventMinutes(prefs.event_reminder_minutes_before ?? 15);
    }
  }, [prefs]);

  useEffect(() => {
    if (profile?.timezone) setTimezone(profile.timezone);
  }, [profile]);

  // Load notification sound preference from device storage on mount.
  useEffect(() => {
    getNotificationSound().then((s) => {
      setNotificationSound(s);
      savedSoundRef.current = s;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Dirty-state + save
  // ---------------------------------------------------------------------------

  const dirty = useMemo(() => {
    if (!prefs || !profile) {
      // Pre-hydration: compare against defaults — treat as clean.
      return false;
    }
    return (
      morningSummaryEnabled !== prefs.morning_summary_enabled ||
      morningSummaryTime !== prefs.morning_summary_time ||
      eodEnabled !== prefs.eod_review_enabled ||
      eodTime !== prefs.eod_review_time ||
      meetingMinutes !== prefs.meeting_reminder_minutes_before ||
      birthdayDays !== prefs.birthday_reminder_days_before ||
      travelDays !== prefs.travel_reminder_days_before ||
      renewalDays !== prefs.renewal_reminder_days_before ||
      activityStartingEnabled !== prefs.activity_starting_enabled ||
      activityMinutes !== prefs.activity_reminder_minutes_before ||
      activityOverdueEnabled !== prefs.activity_overdue_enabled ||
      eventMinutes !== prefs.event_reminder_minutes_before ||
      timezone !== profile.timezone ||
      notificationSound !== savedSoundRef.current
    );
  }, [
    prefs, profile,
    morningSummaryEnabled, morningSummaryTime,
    eodEnabled, eodTime,
    meetingMinutes, birthdayDays, travelDays, renewalDays,
    activityStartingEnabled, activityMinutes, activityOverdueEnabled, eventMinutes,
    timezone, notificationSound,
  ]);

  const saving = updatePrefs.isPending || updateProfile.isPending;

  const handleSave = async () => {
    try {
      await Promise.all([
        updatePrefs.mutateAsync({
          morning_summary_enabled: morningSummaryEnabled,
          morning_summary_time: morningSummaryTime,
          eod_review_enabled: eodEnabled,
          eod_review_time: eodTime,
          meeting_reminder_minutes_before: meetingMinutes,
          birthday_reminder_days_before: birthdayDays,
          travel_reminder_days_before: travelDays,
          renewal_reminder_days_before: renewalDays,
          activity_starting_enabled: activityStartingEnabled,
          activity_reminder_minutes_before: activityMinutes,
          activity_overdue_enabled: activityOverdueEnabled,
          event_reminder_minutes_before: eventMinutes,
        }),
        updateProfile.mutateAsync({
          timezone,
          eod_review_time: eodTime,
        }),
        AsyncStorage.setItem(NOTIFICATION_SOUND_KEY, notificationSound),
      ]);
      savedSoundRef.current = notificationSound;
      // Re-schedule all notifications so they use the new sound channel.
      reschedule().catch(() => {});
      Alert.alert('Saved', 'Your settings have been updated.');
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const handleDiscard = () => {
    if (!prefs || !profile) return;
    setMorningSummaryEnabled(prefs.morning_summary_enabled);
    setMorningSummaryTime(prefs.morning_summary_time);
    setEodEnabled(prefs.eod_review_enabled);
    setEodTime(prefs.eod_review_time);
    setMeetingMinutes(prefs.meeting_reminder_minutes_before);
    setBirthdayDays(prefs.birthday_reminder_days_before);
    setTravelDays(prefs.travel_reminder_days_before);
    setRenewalDays(prefs.renewal_reminder_days_before);
    setActivityStartingEnabled(prefs.activity_starting_enabled ?? true);
    setActivityMinutes(prefs.activity_reminder_minutes_before ?? 5);
    setActivityOverdueEnabled(prefs.activity_overdue_enabled ?? true);
    setEventMinutes(prefs.event_reminder_minutes_before ?? 15);
    setTimezone(profile.timezone);
    setNotificationSound(savedSoundRef.current);
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
  // Timezone picker
  // ---------------------------------------------------------------------------

  const filteredTimezones = useMemo(() => {
    const q = tzSearch.trim().toLowerCase();
    if (!q) return TIMEZONES;
    return TIMEZONES.filter(
      (tz) => tz.value.toLowerCase().includes(q) || tz.label.toLowerCase().includes(q),
    );
  }, [tzSearch]);

  const selectedTzLabel =
    TIMEZONES.find((tz) => tz.value === timezone)?.label ?? timezone;

  // ---------------------------------------------------------------------------
  // Loading gate
  // ---------------------------------------------------------------------------

  if (prefsLoading || profileLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.blue[600]} />
          <Text style={styles.loadingText}>Loading settings…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, dirty && styles.scrollContentWithFooter]}
        keyboardShouldPersistTaps="handled"
      >

        {/* Notifications */}
        <SectionHeader title="Notifications" />

        {/* Morning Summary */}
        <View style={styles.group}>
          <View style={styles.toggleRow}>
            <View style={styles.labelCol}>
              <Text style={styles.rowLabel}>Morning Summary</Text>
              <Text style={styles.rowHelp}>A brief overview of your day's schedule and priorities.</Text>
            </View>
            <Switch
              value={morningSummaryEnabled}
              onValueChange={setMorningSummaryEnabled}
              trackColor={{ false: colors.gray[200], true: colors.blue[400] }}
              thumbColor="#FFFFFF"
            />
          </View>
          {morningSummaryEnabled && (
            <View style={styles.timePickerWrap}>
              <Text style={styles.rowSubLabel}>Summary time</Text>
              <TimePickerField
                value={hhmmToDate(morningSummaryTime)}
                onChange={(d) => setMorningSummaryTime(dateToHhmm(d))}
              />
            </View>
          )}
        </View>

        {/* End-of-Day Review */}
        <View style={styles.group}>
          <View style={styles.toggleRow}>
            <View style={styles.labelCol}>
              <Text style={styles.rowLabel}>End-of-Day Review</Text>
              <Text style={styles.rowHelp}>Reminds you to review unfinished activities and update statuses.</Text>
            </View>
            <Switch
              value={eodEnabled}
              onValueChange={setEodEnabled}
              trackColor={{ false: colors.gray[200], true: colors.blue[400] }}
              thumbColor="#FFFFFF"
            />
          </View>
          {eodEnabled && (
            <View style={styles.timePickerWrap}>
              <Text style={styles.rowSubLabel}>Review time</Text>
              <TimePickerField
                value={hhmmToDate(eodTime)}
                onChange={(d) => setEodTime(dateToHhmm(d))}
              />
            </View>
          )}
        </View>

        {/* Meeting Reminder */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Meeting Reminder</Text>
          <Text style={styles.rowHelp}>Alert before a meeting starts. Set Off to disable; meeting time-passed alerts are always on.</Text>
          <OptionPickerRow
            options={MEETING_REMINDER_OPTIONS}
            value={meetingMinutes}
            format={(v) => (v === 0 ? 'Off' : `${v} min`)}
            onSelect={setMeetingMinutes}
          />
        </View>

        {/* Activity Starting Reminder */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Activity Starting Reminder</Text>
          <Text style={styles.rowHelp}>Alert before a scheduled activity block starts.</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.rowLabel}>Enabled</Text>
            <Switch value={activityStartingEnabled} onValueChange={setActivityStartingEnabled} />
          </View>
          {activityStartingEnabled && (
            <OptionPickerRow
              options={ACTIVITY_REMINDER_OPTIONS}
              value={activityMinutes}
              format={(v) => (v === 0 ? 'At start' : `${v} min before`)}
              onSelect={setActivityMinutes}
            />
          )}
        </View>

        {/* Activity Overdue Reminder */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Activity Overdue Reminder</Text>
          <Text style={styles.rowHelp}>Prompt to update status when a scheduled block's end time has passed.</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.rowLabel}>Enabled</Text>
            <Switch value={activityOverdueEnabled} onValueChange={setActivityOverdueEnabled} />
          </View>
        </View>

        {/* Calendar Event Reminder (appointments / other) */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Appointment Reminder</Text>
          <Text style={styles.rowHelp}>Alert before an appointment or other calendar event starts.</Text>
          <OptionPickerRow
            options={EVENT_REMINDER_OPTIONS}
            value={eventMinutes}
            format={(v) => (v === 0 ? 'Off' : `${v} min`)}
            onSelect={setEventMinutes}
          />
        </View>

        {/* Birthday Reminder */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Birthday Reminder</Text>
          <OptionPickerRow
            options={BIRTHDAY_REMINDER_OPTIONS}
            value={birthdayDays}
            format={formatDaysBefore}
            onSelect={setBirthdayDays}
          />
        </View>

        {/* Travel Reminder */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Travel Reminder</Text>
          <OptionPickerRow
            options={TRAVEL_REMINDER_OPTIONS}
            value={travelDays}
            format={formatDaysBefore}
            onSelect={setTravelDays}
          />
        </View>

        {/* Renewal Reminder */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Renewal Reminder</Text>
          <OptionPickerRow
            options={RENEWAL_REMINDER_OPTIONS}
            value={renewalDays}
            format={formatDaysBefore}
            onSelect={setRenewalDays}
          />
        </View>

        {/* Notification Sound */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Notification Sound</Text>
          <Text style={styles.rowHelp}>Sound played when a reminder fires.</Text>
          <OptionPickerRow
            options={NOTIFICATION_SOUND_OPTIONS}
            value={notificationSound}
            format={(v) => NOTIFICATION_SOUND_LABELS[v]}
            onSelect={setNotificationSound}
          />
        </View>

        <Text style={styles.sectionFooter}>
          Birthdays and travel driven from Year at a Glance. Renewals driven from recurring expenses.
        </Text>

        {/* Display */}
        <SectionHeader title="Display" />

        <View style={styles.group}>
          <TouchableOpacity
            style={styles.plainRow}
            onPress={() => { setTzSearch(''); setTzPickerVisible(true); }}
          >
            <View style={styles.labelCol}>
              <Text style={styles.rowLabel}>Timezone</Text>
              <Text style={styles.rowHelp}>Used for scheduling reminders and displaying the correct local date/time.</Text>
            </View>
            <Text style={styles.rowValue} numberOfLines={1}>{timezone}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Developer */}
        <SectionHeader title="Developer" />

        <View style={styles.group}>
          <TouchableOpacity
            style={styles.plainRow}
            onPress={() => router.push('/notification-test' as never)}
          >
            <View style={styles.labelCol}>
              <Text style={styles.rowLabel}>Test Notifications</Text>
              <Text style={styles.rowHelp}>Send a test notification for each reminder type.</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Account */}
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

      {/* Sticky save bar — appears when dirty */}
      {dirty && (
        <View style={styles.saveBar}>
          <View style={styles.saveBarInfo}>
            <Text style={styles.saveBarText}>You have unsaved changes</Text>
          </View>
          <TouchableOpacity
            style={styles.discardBtn}
            onPress={handleDiscard}
            disabled={saving}
          >
            <Text style={styles.discardBtnText}>Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save changes</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Timezone picker modal */}
      <Modal
        visible={tzPickerVisible}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setTzPickerVisible(false)}
      >
        <SafeAreaView style={styles.tzModal} edges={['top', 'bottom']}>
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
              placeholder="Search timezone…"
              placeholderTextColor={colors.gray[400]}
              autoFocus
              clearButtonMode="while-editing"
            />
          </View>
          <Text style={styles.tzSelectedLabel}>
            Current: {selectedTzLabel}
          </Text>
          <ScrollView>
            {filteredTimezones.map((tz) => (
              <TouchableOpacity
                key={tz.value}
                style={[styles.tzItem, timezone === tz.value && styles.tzItemActive]}
                onPress={() => {
                  setTimezone(tz.value);
                  setTzPickerVisible(false);
                }}
              >
                <Text
                  style={[styles.tzItemText, timezone === tz.value && styles.tzItemTextActive]}
                  numberOfLines={2}
                >
                  {tz.label}
                </Text>
                {timezone === tz.value && <Text style={styles.tzCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
            {filteredTimezones.length === 0 && (
              <Text style={styles.tzEmpty}>No timezones match your search.</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>;
}

function formatDaysBefore(v: number): string {
  if (v === 0) return 'Same day';
  return `${v} day${v > 1 ? 's' : ''} before`;
}

function OptionPickerRow<T extends string | number>({
  options,
  value,
  format,
  onSelect,
}: {
  options: T[];
  value: T;
  format: (v: T) => string;
  onSelect: (v: T) => void;
}) {
  return (
    <View style={styles.optionRow}>
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

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { fontFamily: fontFamily.sans, fontSize: fontSize.sm, color: colors.gray[500] },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing['3xl'] * 2 },
  scrollContentWithFooter: { paddingBottom: 140 },

  // Section
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
  sectionFooter: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[500],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    lineHeight: 16,
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
    color: colors.gray[700],
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 2,
  },

  // Rows
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
  labelCol: { flex: 1, gap: 2 },
  rowLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
    fontWeight: '500',
  },
  rowHelp: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[500],
    paddingHorizontal: spacing.md,
    lineHeight: 16,
  },
  rowValue: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
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
    marginBottom: spacing.xs,
  },
  chevron: {
    fontFamily: fontFamily.sans,
    fontSize: 18,
    color: colors.gray[400],
  },

  // Time picker wrap
  timePickerWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },

  // Option picker
  optionRow: {
    paddingTop: spacing.sm,
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

  // Sticky save bar
  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.blue[100],
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  saveBarInfo: { flex: 1 },
  saveBarText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.amber[700],
    fontWeight: '500',
  },
  discardBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  discardBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.gray[700],
  },
  saveBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.blue[600],
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: colors.blue[300] },
  saveBtnText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
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
  tzSelectedLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[500],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: '#FFFFFF',
  },
  tzItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[50],
    backgroundColor: '#FFFFFF',
    gap: spacing.sm,
  },
  tzItemActive: { backgroundColor: colors.blue[50] },
  tzItemText: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.DEFAULT,
  },
  tzItemTextActive: { color: colors.blue[700], fontWeight: '600' },
  tzCheck: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.blue[600],
    fontWeight: '700',
  },
  tzEmpty: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.gray[400],
    textAlign: 'center',
    padding: spacing.xl,
  },
});
