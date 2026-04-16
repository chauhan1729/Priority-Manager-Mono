import { Stack } from 'expo-router';
import { TopBar } from '../../src/components/layout/TopBar';

export default function AnnualStrategiesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        header: () => <TopBar title="Annual Strategies" />,
      }}
    />
  );
}
