import { Tabs } from "expo-router";

/**
 * Spec §8: 10 navigation items. On mobile we use bottom tabs for the primary 5
 * (Daily Plan, Activities, Calendar, Meeting Planner, More).
 * "More" opens a drawer/sheet with the remaining 5.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2563EB",
        tabBarInactiveTintColor: "#4A4A6A",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#DBEAFE",
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen name="daily-plan" options={{ title: "Daily Plan" }} />
      <Tabs.Screen name="activities" options={{ title: "Activities" }} />
      <Tabs.Screen name="calendar" options={{ title: "Calendar" }} />
      <Tabs.Screen name="meeting-planner" options={{ title: "Meetings" }} />
      <Tabs.Screen name="more" options={{ title: "More" }} />
    </Tabs>
  );
}
