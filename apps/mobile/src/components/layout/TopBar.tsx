import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Rect, Line, Circle, Polyline } from "react-native-svg";
import { colors } from "../../theme/colors";
import { fontFamily, fontSize } from "../../theme/typography";
import { useDrawer } from "../providers/DrawerProvider";

function NotebookLogo() {
  return (
    <Svg viewBox="0 0 32 32" width={28} height={28} fill="none">
      <Rect x={4} y={2} width={24} height={28} rx={3} fill="#EFF6FF" stroke="#BFDBFE" strokeWidth={1.5} />
      <Line x1={10} y1={2} x2={10} y2={30} stroke="#BFDBFE" strokeWidth={1.5} />
      <Circle cx={10} cy={8} r={1.5} fill="#93C5FD" />
      <Circle cx={10} cy={14} r={1.5} fill="#93C5FD" />
      <Circle cx={10} cy={20} r={1.5} fill="#93C5FD" />
      <Circle cx={10} cy={26} r={1.5} fill="#93C5FD" />
      <Line x1={14} y1={11} x2={24} y2={11} stroke="#60A5FA" strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={14} y1={16} x2={24} y2={16} stroke="#60A5FA" strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={14} y1={21} x2={20} y2={21} stroke="#60A5FA" strokeWidth={1.5} strokeLinecap="round" />
      <Polyline
        points="14,8 16,10 20,6"
        stroke="#2563EB"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

interface TopBarProps {
  title?: string;
}

export function TopBar({ title }: TopBarProps) {
  const { openDrawer } = useDrawer();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.inner}>
        <TouchableOpacity
          onPress={openDrawer}
          style={styles.logoButton}
          accessibilityLabel="Open navigation menu"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <NotebookLogo />
        </TouchableOpacity>

        <Text style={styles.title} numberOfLines={1}>
          {title ?? "Priority Manager"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[100],
  },
  inner: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
  },
  logoButton: {
    padding: 4,
    borderRadius: 8,
  },
  title: {
    fontFamily: fontFamily.handwriting,
    fontSize: fontSize.xl,
    color: colors.ink.DEFAULT,
    flex: 1,
  },
});
