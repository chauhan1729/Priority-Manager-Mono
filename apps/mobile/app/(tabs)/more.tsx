import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { fontSize, fontFamily } from "../../src/theme/typography";

/** Navigation items not in the primary tab bar. */
const MORE_ITEMS = [
  { href: "/year-at-a-glance",      label: "Year at a Glance" },
  { href: "/annual-strategies",     label: "Annual Strategies" },
  { href: "/monthly-priorities",    label: "Monthly Priorities" },
  { href: "/communication-planner", label: "Communication Planner" },
  { href: "/project-planner",       label: "Project Planner" },
  { href: "/expense-record",        label: "Expense Record" },
  { href: "/settings",              label: "Settings" },
] as const;

export default function MoreScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
      </View>
      <ScrollView style={styles.content}>
        {MORE_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.href}
            style={styles.row}
            onPress={() => router.push(item.href as never)}
          >
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAF8" },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize["2xl"],
    color: colors.ink.DEFAULT,
  },
  content: { flex: 1 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  rowLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    color: colors.ink.DEFAULT,
    fontWeight: "500",
  },
  chevron: {
    fontFamily: fontFamily.sans,
    fontSize: 20,
    color: colors.gray[400],
  },
});
