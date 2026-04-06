import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { AnnualGoal, Project } from '@pm/types';
import { useLinkProjectToGoal, useUnlinkProjectFromGoal } from '../../hooks/useAnnualGoals';
import { useProjects } from '../../hooks/useProjects';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { fontSize, fontFamily } from '../../theme/typography';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  visible: boolean;
  goal: AnnualGoal;
  linkedProjects: Project[];
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectLinkModal({ visible, goal, linkedProjects, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: allProjects = [] } = useProjects();
  const linkMutation = useLinkProjectToGoal();
  const unlinkMutation = useUnlinkProjectFromGoal();

  const linkedIds = useMemo(() => new Set(linkedProjects.map((p) => p.id)), [linkedProjects]);

  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return allProjects;
    return allProjects.filter((p) => p.name.toLowerCase().includes(q));
  }, [allProjects, search]);

  const handleLink = (projectId: string) => {
    setError(null);
    linkMutation.mutate(
      { goalId: goal.id, projectId },
      { onError: (e: Error) => setError(e.message) },
    );
  };

  const handleUnlink = (projectId: string) => {
    setError(null);
    unlinkMutation.mutate(
      { goalId: goal.id, projectId },
      { onError: (e: Error) => setError(e.message) },
    );
  };

  const isPending = linkMutation.isPending || unlinkMutation.isPending;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Link Projects</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Search */}
        <View style={styles.searchRow}>
          <RNTextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search projects…"
            placeholderTextColor={colors.gray[400]}
            clearButtonMode="while-editing"
            autoCapitalize="none"
          />
        </View>

        <FlatList
          data={filteredProjects}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isLinked = linkedIds.has(item.id);
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => (isLinked ? handleUnlink(item.id) : handleLink(item.id))}
                disabled={isPending}
                activeOpacity={0.75}
              >
                <View style={styles.rowContent}>
                  <Text style={styles.projectName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.projectStatus}>{item.status.replace('_', ' ')}</Text>
                </View>
                <View style={[styles.linkBadge, isLinked && styles.linkBadgeActive]}>
                  <Text style={[styles.linkBadgeText, isLinked && styles.linkBadgeTextActive]}>
                    {isLinked ? 'Linked ✓' : 'Link'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No projects found.</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
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
  doneText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.blue[600],
  },
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
  searchRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.blue[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
    backgroundColor: '#FAFAF8',
  },
  listContent: { paddingBottom: spacing['3xl'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#FFFFFF',
    gap: spacing.md,
  },
  rowContent: { flex: 1, gap: 2 },
  projectName: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    fontWeight: '500',
    color: colors.ink.DEFAULT,
  },
  projectStatus: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.gray[400],
    textTransform: 'capitalize',
  },
  linkBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[300],
    backgroundColor: '#FFFFFF',
  },
  linkBadgeActive: {
    backgroundColor: colors.blue[600],
    borderColor: colors.blue[600],
  },
  linkBadgeText: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    color: colors.ink.light,
    fontWeight: '500',
  },
  linkBadgeTextActive: { color: '#FFFFFF' },
  separator: { height: 1, backgroundColor: colors.blue[50], marginLeft: spacing.lg },
  empty: { paddingTop: spacing['3xl'], alignItems: 'center' },
  emptyText: { fontFamily: fontFamily.sans, fontSize: fontSize.base, color: colors.gray[400] },
});
