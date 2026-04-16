import Svg, {
  Rect,
  Line,
  Circle,
  Polyline,
  Path,
  Polygon,
} from "react-native-svg";

interface IconProps {
  color: string;
  size?: number;
}

export function IconDailyPlan({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 20 20" width={size} height={size} fill="none">
      <Rect x={3} y={2} width={14} height={16} rx={2} stroke={color} strokeWidth={1.5} />
      <Line x1={6} y1={7} x2={14} y2={7} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={6} y1={10} x2={14} y2={10} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={6} y1={13} x2={10} y2={13} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

export function IconActivities({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 20 20" width={size} height={size} fill="none">
      <Polyline
        points="4,10 8,14 16,6"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconCalendar({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 20 20" width={size} height={size} fill="none">
      <Rect x={3} y={4} width={14} height={13} rx={2} stroke={color} strokeWidth={1.5} />
      <Line x1={7} y1={2} x2={7} y2={6} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={13} y1={2} x2={13} y2={6} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={3} y1={9} x2={17} y2={9} stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

export function IconYearAtAGlance({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 20 20" width={size} height={size} fill="none">
      <Circle cx={10} cy={10} r={7} stroke={color} strokeWidth={1.5} />
      <Line x1={10} y1={3} x2={10} y2={10} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={10} y1={10} x2={14} y2={13} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

export function IconAnnualStrategies({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 20 20" width={size} height={size} fill="none">
      <Polyline
        points="3,14 7,9 11,11 17,5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconMonthlyPriorities({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 20 20" width={size} height={size} fill="none">
      <Polygon
        points="10,2 12.5,7.5 18,8.3 14,12.2 15,17.5 10,14.8 5,17.5 6,12.2 2,8.3 7.5,7.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconProjectPlanner({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 20 20" width={size} height={size} fill="none">
      <Rect x={2} y={5} width={16} height={11} rx={2} stroke={color} strokeWidth={1.5} />
      <Line x1={2} y1={9} x2={18} y2={9} stroke={color} strokeWidth={1.5} />
      <Line x1={8} y1={5} x2={8} y2={16} stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

export function IconMeetingPlanner({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 20 20" width={size} height={size} fill="none">
      <Circle cx={7} cy={7} r={3} stroke={color} strokeWidth={1.5} />
      <Circle cx={14} cy={7} r={2.5} stroke={color} strokeWidth={1.5} />
      <Path d="M2 17c0-2.8 2.2-5 5-5h0.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M11 17c0-2.2 1.6-4 3.5-4s3.5 1.8 3.5 4" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

export function IconCommunicationPlanner({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 20 20" width={size} height={size} fill="none">
      <Path
        d="M17 3H3a1 1 0 00-1 1v9a1 1 0 001 1h3l3 3 3-3h5a1 1 0 001-1V4a1 1 0 00-1-1z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconExpenseRecord({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 20 20" width={size} height={size} fill="none">
      <Circle cx={10} cy={10} r={7} stroke={color} strokeWidth={1.5} />
      <Line x1={10} y1={6} x2={10} y2={7} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={10} y1={13} x2={10} y2={14} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={8} y1={10} x2={12} y2={10} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

export function IconSettings({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 20 20" width={size} height={size} fill="none">
      <Circle cx={10} cy={10} r={2.5} stroke={color} strokeWidth={1.5} />
      <Path
        d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}
