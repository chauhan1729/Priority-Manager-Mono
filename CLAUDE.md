# Priority Manager project rules

## Product goals
This is a personal productivity app for web + Android + iOS.
The product is not a team collaboration tool.

## Core architectural rules
- Daily Plan is the default home screen.
- Activities, Daily Plan, and Project Planner must share one activity source of truth.
- Use ScheduleInstance for all timed scheduling.
- Never create duplicate records across modules.
- Birthdays sync from Year at a Glance into Calendar without duplicating data.
- Meetings created anywhere must map to one shared Meeting record.
- Past records remain visible.
- New meetings, activities, or schedule blocks cannot be created in the past.
- Past meetings allow editing only of key takeaways.

## Technical rules
- Prefer TypeScript everywhere.
- Use schema-first development with Zod and typed DB models.
- Keep domain logic in shared packages, not UI components.
- Add tests for sync rules, past-time permissions, recurrence, and overlap prevention.
- Do not use mock-only implementations unless explicitly requested.
- For every feature, update types, tests, and docs.

## UI rules
- Light mode only.
- Notebook-inspired visual language.
- Handwritten font only for accents/headings, not dense body text.
- Prioritize readability over stylistic novelty.
- Mobile responsiveness is required for every screen.

## Delivery rules
- Before implementation, write a short implementation plan.
- After implementation, list changed files, domain rules added, tests added, and remaining risks.