import { useEffect } from "react";
import {
  BackHandler,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, router } from "expo-router";
import Svg, { Rect, Line, Circle, Polyline } from "react-native-svg";

import { useDrawer } from "../providers/DrawerProvider";
import { useAuth } from "../providers/AuthProvider";
import { colors } from "../../theme/colors";
import { fontFamily, fontSize } from "../../theme/typography";
import {
  IconDailyPlan,
  IconActivities,
  IconCalendar,
  IconYearAtAGlance,
  IconAnnualStrategies,
  IconMonthlyPriorities,
  IconProjectPlanner,
  IconMeetingPlanner,
  IconCommunicationPlanner,
  IconExpenseRecord,
  IconSettings,
} from "./NavIcons";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRAWER_WIDTH = 280;
const ANIMATION_DURATION = 250;

// Items that mirror the bottom tabs (shown at top of drawer)
const TAB_NAV_ITEMS = [
  { href: "/(tabs)/daily-plan", label: "Daily Plan", Icon: IconDailyPlan },
  { href: "/(tabs)/activities", label: "Activities", Icon: IconActivities },
] as const;

const NAV_ITEMS = [
  { href: "/calendar", label: "Calendar", Icon: IconCalendar },
  { href: "/year-at-a-glance", label: "Year at a Glance", Icon: IconYearAtAGlance },
  { href: "/annual-strategies", label: "Annual Strategies", Icon: IconAnnualStrategies },
  { href: "/monthly-priorities", label: "Monthly Priorities", Icon: IconMonthlyPriorities },
  { href: "/project-planner", label: "Project Planner", Icon: IconProjectPlanner },
  { href: "/meeting-planner", label: "Meeting Planner", Icon: IconMeetingPlanner },
  { href: "/communication-planner", label: "Communication Planner", Icon: IconCommunicationPlanner },
  { href: "/expense-record", label: "Expense Record", Icon: IconExpenseRecord },
  { href: "/settings", label: "Settings", Icon: IconSettings },
] as const;

// ---------------------------------------------------------------------------
// Logo (same as TopBar)
// ---------------------------------------------------------------------------

function NotebookLogo() {
  return (
    <Svg viewBox="0 0 32 32" width={32} height={32} fill="none">
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

// ---------------------------------------------------------------------------
// Close icon
// ---------------------------------------------------------------------------

function CloseIcon() {
  return (
    <Svg viewBox="0 0 20 20" width={20} height={20} fill="none">
      <Line x1={4} y1={4} x2={16} y2={16} stroke={colors.ink.light} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={16} y1={4} x2={4} y2={16} stroke={colors.ink.light} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppDrawer() {
  const { isDrawerOpen, closeDrawer } = useDrawer();
  const { user } = useAuth();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const translateX = useSharedValue(-DRAWER_WIDTH);
  const backdropOpacity = useSharedValue(0);

  // Animate open/close
  useEffect(() => {
    if (isDrawerOpen) {
      translateX.value = withTiming(0, {
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      backdropOpacity.value = withTiming(1, { duration: ANIMATION_DURATION });
    } else {
      translateX.value = withTiming(-DRAWER_WIDTH, {
        duration: ANIMATION_DURATION,
        easing: Easing.in(Easing.cubic),
      });
      backdropOpacity.value = withTiming(0, { duration: ANIMATION_DURATION });
    }
  }, [isDrawerOpen]);

  // Handle Android back button
  useEffect(() => {
    if (!isDrawerOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeDrawer();
      return true;
    });
    return () => sub.remove();
  }, [isDrawerOpen]);

  // Swipe-to-close gesture
  const panGesture = Gesture.Pan()
    .activeOffsetX(-10)
    .onUpdate((e) => {
      if (e.translationX < 0) {
        translateX.value = e.translationX;
        backdropOpacity.value = Math.max(0, 1 + e.translationX / DRAWER_WIDTH);
      }
    })
    .onEnd((e) => {
      if (e.translationX < -DRAWER_WIDTH * 0.3 || e.velocityX < -500) {
        translateX.value = withTiming(-DRAWER_WIDTH, { duration: 200 });
        backdropOpacity.value = withTiming(0, { duration: 200 });
        runOnJS(closeDrawer)();
      } else {
        translateX.value = withTiming(0, { duration: 200 });
        backdropOpacity.value = withTiming(1, { duration: 200 });
      }
    });

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
    pointerEvents: backdropOpacity.value > 0 ? ("auto" as const) : ("none" as const),
  }));

  const handleNavPress = (href: string) => {
    closeDrawer();
    router.push(href as never);
  };

  const displayName = user?.user_metadata?.full_name as string | undefined;
  const displayEmail = user?.email ?? "";

  return (
    <>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
      </Animated.View>

      {/* Drawer panel */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.drawer,
            drawerStyle,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <NotebookLogo />
              <Text style={styles.brandTitle}>Priority Manager</Text>
            </View>
            <TouchableOpacity
              onPress={closeDrawer}
              style={styles.closeButton}
              accessibilityLabel="Close menu"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <CloseIcon />
            </TouchableOpacity>
          </View>

          {/* Nav items */}
          <ScrollView style={styles.nav} showsVerticalScrollIndicator={false}>
            {/* Tab shortcuts: Daily Plan + Activities */}
            {TAB_NAV_ITEMS.map(({ href, label, Icon }) => {
              const isActive = pathname.includes(label.toLowerCase().replace(" ", "-"));
              return (
                <TouchableOpacity
                  key={href}
                  onPress={() => handleNavPress(href)}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                  activeOpacity={0.7}
                >
                  <Icon color={isActive ? colors.blue[700] : colors.ink.light} />
                  <Text
                    style={[styles.navLabel, isActive && styles.navLabelActive]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Separator */}
            <View style={styles.navDivider} />

            {/* Other screens */}
            {NAV_ITEMS.map(({ href, label, Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <TouchableOpacity
                  key={href}
                  onPress={() => handleNavPress(href)}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                  activeOpacity={0.7}
                >
                  <Icon color={isActive ? colors.blue[700] : colors.ink.light} />
                  <Text
                    style={[styles.navLabel, isActive && styles.navLabelActive]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            {displayName ? (
              <Text style={styles.footerName} numberOfLines={1}>
                {displayName}
              </Text>
            ) : null}
            <Text style={styles.footerEmail} numberOfLines={1}>
              {displayEmail}
            </Text>
            <Text style={styles.footerDate}>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>
        </Animated.View>
      </GestureDetector>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 100,
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRightWidth: 1,
    borderRightColor: colors.blue[100],
    zIndex: 101,
  },
  // Header
  header: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.blue[50],
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  brandTitle: {
    fontFamily: fontFamily.handwriting,
    fontSize: 20,
    color: colors.ink.DEFAULT,
    flexShrink: 1,
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  // Nav
  nav: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  navDivider: {
    height: 1,
    backgroundColor: colors.blue[50],
    marginHorizontal: 8,
    marginVertical: 8,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  navItemActive: {
    backgroundColor: colors.blue[50],
  },
  navLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.ink.light,
    flexShrink: 1,
  },
  navLabelActive: {
    color: colors.blue[700],
  },
  // Footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.blue[100],
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 4,
  },
  footerName: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.ink.DEFAULT,
  },
  footerEmail: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    color: colors.ink.light,
  },
  footerDate: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: "500",
    color: colors.ink.light,
    marginTop: 4,
  },
});
