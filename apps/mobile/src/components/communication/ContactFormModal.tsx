import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Contact, ContactCategory } from '@pm/types';
import {
  type CreateContactInput,
  type UpdateContactInput,
  useCreateContact,
  useUpdateContact,
} from '../../hooks/useContacts';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

const CATEGORIES: { label: string; value: ContactCategory }[] = [
  { label: 'Personal',     value: 'personal' },
  { label: 'Professional', value: 'professional' },
  { label: 'Family',       value: 'family' },
  { label: 'Client',       value: 'client' },
  { label: 'Vendor',       value: 'vendor' },
  { label: 'Other',        value: 'other' },
];

interface Props {
  visible: boolean;
  editContact?: Contact | null;
  onClose: () => void;
}

export function ContactFormModal({ visible, editContact, onClose }: Props) {
  const isEdit = !!editContact;

  const [fullName, setFullName] = useState('');
  const [category, setCategory] = useState<ContactCategory>('professional');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateContact();
  const updateMutation = useUpdateContact();
  const isPending = isEdit ? updateMutation.isPending : createMutation.isPending;

  // Reset form when modal opens
  useEffect(() => {
    if (!visible) return;
    if (editContact) {
      setFullName(editContact.full_name);
      setCategory(editContact.category);
      setCompany(editContact.company ?? '');
      setRole(editContact.role ?? '');
      setPhone(editContact.phone ?? '');
      setEmail(editContact.email ?? '');
      setNote(editContact.note ?? '');
    } else {
      setFullName('');
      setCategory('professional');
      setCompany('');
      setRole('');
      setPhone('');
      setEmail('');
      setNote('');
    }
    setError(null);
  }, [visible, editContact]);

  const handleSave = () => {
    setError(null);
    if (!fullName.trim()) { setError('Name is required.'); return; }

    if (isEdit && editContact) {
      const input: UpdateContactInput = {
        id: editContact.id,
        full_name: fullName.trim(),
        category,
        company: company.trim() || null,
        role: role.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
      };
      updateMutation.mutate(input, {
        onSuccess: onClose,
        onError: (e: Error) => setError(e.message),
      });
    } else {
      const input: CreateContactInput = {
        full_name: fullName.trim(),
        category,
        company: company.trim() || null,
        role: role.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        note: note.trim() || null,
      };
      createMutation.mutate(input, {
        onSuccess: onClose,
        onError: (e: Error) => setError(e.message),
      });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={isPending}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'Edit Contact' : 'New Contact'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={isPending}>
            <Text style={[styles.saveText, isPending && styles.textDisabled]}>
              {isPending ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Name */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Full Name *</Text>
            <RNTextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Jane Smith"
              placeholderTextColor={colors.gray[400]}
              autoFocus={!isEdit}
            />
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.value;
                return (
                  <TouchableOpacity
                    key={cat.value}
                    style={[styles.chip, isSelected && styles.chipActive]}
                    onPress={() => setCategory(cat.value)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Company */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Company (optional)</Text>
            <RNTextInput
              style={styles.input}
              value={company}
              onChangeText={setCompany}
              placeholder="e.g. Acme Corp"
              placeholderTextColor={colors.gray[400]}
            />
          </View>

          {/* Role */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Role (optional)</Text>
            <RNTextInput
              style={styles.input}
              value={role}
              onChangeText={setRole}
              placeholder="e.g. Product Manager"
              placeholderTextColor={colors.gray[400]}
            />
          </View>

          {/* Phone */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Phone (optional)</Text>
            <RNTextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor={colors.gray[400]}
              keyboardType="phone-pad"
            />
          </View>

          {/* Email */}
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Email (optional)</Text>
            <RNTextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="jane@example.com"
              placeholderTextColor={colors.gray[400]}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Note — only on create; on edit it's managed separately via rolling notes */}
          {!isEdit && (
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Initial Note (optional)</Text>
              <RNTextInput
                style={[styles.input, styles.multilineInput]}
                value={note}
                onChangeText={setNote}
                placeholder="Any context about this contact…"
                placeholderTextColor={colors.gray[400]}
                multiline
                textAlignVertical="top"
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
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
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.ink.DEFAULT,
  },
  cancelText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.gray[500],
  },
  saveText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.blue[600],
  },
  textDisabled: { opacity: 0.5 },
  scroll: { flex: 1 },
  errorBox: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.red[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.red[200],
  },
  errorText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.red[600],
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  fieldLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.gray[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.blue[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
    backgroundColor: '#FFFFFF',
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[300],
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    backgroundColor: colors.blue[600],
    borderColor: colors.blue[600],
  },
  chipText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.light,
  },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
});
