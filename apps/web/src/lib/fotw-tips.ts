/**
 * Fly On The Wall (Priority Manager) usage tips.
 *
 * Distilled from the "Fly On The Wall — Danielle" training testimonial and the
 * supporting testimonials in fotw.txt. Ordered as a reading sequence: core
 * mindset first, then execution, then the deeper practices. Edit this file to
 * change tip copy — it is the single source of truth rendered by FotwTipsModal.
 */

export interface FotwTipTheme {
  id: string;
  /** Emoji shown beside the theme heading. */
  icon: string;
  title: string;
  /** Short tips, each a single intentional practice. */
  tips: string[];
}

export const FOTW_TIPS: FotwTipTheme[] = [
  {
    id: "daily-rhythm",
    icon: "🌅",
    title: "The daily rhythm",
    tips: [
      "Plan more than you do — time spent planning is how you manage more with less stress.",
      "Plan tomorrow tonight: move incompletes forward, assign A's and B's, pick the one B you'd love to focus on.",
      "Start mornings slow and relaxed — clear all messages and get centered before doing.",
      "Confront your finances every evening with gratitude and abundance.",
      "Be intentional in every action — even in writing your to-do list.",
    ],
  },
  {
    id: "everything-is-a-b",
    icon: "🅱️",
    title: "Everything is a B",
    tips: [
      "Keep only 1–2 A's a day — often just one. An A is something that genuinely must happen today; almost nothing qualifies.",
      "Everything else is a B. \"Everything is a B, this creates no stress — I do things because I want to, not because I have to.\"",
      "Choosing your next B, ask: \"Which one is the priority?\" or \"Which one seems fun?\"",
      "A daily commitment (read, gym) is not an A — block it as a calendar appointment with yourself.",
    ],
  },
  {
    id: "handle-todays-a",
    icon: "🎯",
    title: "Handle today's A",
    tips: [
      "Your A is the one thing that must happen today — schedule it as a real block on your timeline and protect that time.",
      "Do it when you're fresh. Kevin saves big projects for the start of the day; give your A your best energy, not your leftovers.",
      "Set up first: clear your desk, close every tab and app, silence interruptions — then almost pause to mark the start of the cycle.",
      "Single-task it. If a new email or idea arrives mid-cycle, jot it down and keep going — finish the cycle before you look. Discipline over distraction.",
      "Break a large A into mini-cycles with short breaks, and mark each one complete.",
      "When it's done, say it: \"Completed, everything is handled, I'm ahead of schedule.\" The rest of the day is yours — relax, or pull a B forward to get ahead.",
    ],
  },
  {
    id: "cycles",
    icon: "🔄",
    title: "Cycles — start clean, finish complete",
    tips: [
      "Before a big task, set up your space and mind: clear the desk, close every tab and app. Ease makes you productive.",
      "Break large projects into mini-cycles with short breaks. Keep breaks short to hold focus; move your body between cycles.",
      "Mark every cycle complete — even tiny ones. The acknowledgment is the point.",
      "Use the cycle note to state what it's about and the ideal scene.",
    ],
  },
  {
    id: "redate-with-intention",
    icon: "↪️",
    title: "Re-date B's with intention",
    tips: [
      "Don't reflexively roll undone B's to tomorrow. Pause and assign each to a specific future day.",
      "As you scan your B's, visualize each already completed — they're often done by the time you reach them.",
      "Non-urgent? Schedule it at least a week out to give your subconscious time to work on it.",
    ],
  },
  {
    id: "thirty-day-horizon",
    icon: "🗓️",
    title: "Keep only the next 30 days",
    tips: [
      "Anything beyond 30 days goes to Someday. Carrying two months of pages is invisible weight on your mind.",
      "Review your Someday list once a week and pull forward only what's ready.",
    ],
  },
  {
    id: "meetings",
    icon: "🤝",
    title: "Meetings — prep + buffer",
    tips: [
      "One day before any meeting, schedule time to prepare.",
      "Leave 15 minutes of \"do nothing\" before each meeting so you arrive fresh, not rushed.",
      "In the meeting, review line by line with clarifying questions — remove every \"misunderstood.\"",
    ],
  },
  {
    id: "six-time-book",
    icon: "📓",
    title: "Karmic Management — track, don't judge",
    tips: [
      "Mental gardening (tundruk): tracking your behavior — without guilt — quietly changes it. It's a cold, calculating adjustment of your upcoming reality, not a confession.",
      "There's no \"guilt\" here — only intelligent regret that decides to do things differently.",
      "Pause roughly every two hours for a quick entry — six light check-ins a day keep patterns from taking root.",
      "Be specific. Not \"I was nice today\" but \"At 3:15 I went to Susan's desk and thanked her.\" A few honest seconds, short and sweet.",
      "Keep To-Do's modest and symbolic — a game plan that's easy to win.",
      "Start with your three biggest problems and cycle through them. As one improves, swap in the next biggest.",
      "Before sleep, list your top 3 best and top 3 worst things from the last 24 hours — free of judgment.",
    ],
  },
  {
    id: "giving",
    icon: "🎁",
    title: "Giving — the Karma Scorecard",
    tips: [
      "Give and recognize others daily, and track it.",
      "A short message of recognition costs nothing and compounds.",
    ],
  },
];
