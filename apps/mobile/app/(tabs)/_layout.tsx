import { Tabs } from "expo-router";
import { TopBar } from "../../src/components/layout/TopBar";
import { IconDailyPlan, IconActivities } from "../../src/components/layout/NavIcons";

/**
 * Bottom tab bar with 2 primary tabs: Daily Plan and Activities.
 * All other screens are accessible via the sidebar drawer (logo tap in TopBar).
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
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
      <Tabs.Screen
        name="daily-plan"
        options={{
          title: "Daily Plan",
          header: () => <TopBar title="Daily Plan" />,
          tabBarIcon: ({ color }) => <IconDailyPlan color={color} />,
        }}
      />
      <Tabs.Screen
        name="activities"
        options={{
          title: "Activities",
          header: () => <TopBar title="Activities" />,
          tabBarIcon: ({ color }) => <IconActivities color={color} />,
        }}
      />
    </Tabs>
  );
}
