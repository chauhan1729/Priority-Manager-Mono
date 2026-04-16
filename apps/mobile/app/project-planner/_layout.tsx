import { Stack } from 'expo-router';
import { TopBar } from '../../src/components/layout/TopBar';

export default function ProjectPlannerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        header: () => <TopBar title="Project Planner" />,
      }}
    />
  );
}
