import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput as RNTextInput, View } from 'react-native';
import { useUpdateProjectNotes } from '../../hooks/useProjects';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

interface Props {
  projectId: string;
  initialNotes: string | null;
}

export function NotesTab({ projectId, initialNotes }: Props) {
  const [notes, setNotes] = useState(initialNotes ?? '');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateNotes = useUpdateProjectNotes();

  // Sync when project changes
  useEffect(() => {
    setNotes(initialNotes ?? '');
  }, [projectId, initialNotes]);

  const handleChange = useCallback(
    (text: string) => {
      setNotes(text);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateNotes.mutate({ id: projectId, notes: text });
      }, 1000);
    },
    [projectId, updateNotes],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        {updateNotes.isPending && (
          <Text style={styles.saving}>Saving…</Text>
        )}
      </View>
      <RNTextInput
        style={styles.input}
        value={notes}
        onChangeText={handleChange}
        placeholder="Project notes, decisions, context…"
        placeholderTextColor={colors.gray[400]}
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md },
  statusRow: {
    height: 20,
    alignItems: 'flex-end',
    marginBottom: spacing.xs,
  },
  saving: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[400],
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.blue[100],
    padding: spacing.md,
    textAlignVertical: 'top',
  },
});
