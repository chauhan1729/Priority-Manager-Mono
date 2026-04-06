-- Migration 008: add FK from projects → monthly_priorities
-- Resolves circular dep: projects created without FK (migration 004),
-- monthly_priorities created (migration 007), now wire the FK.

alter table public.projects
  add constraint fk_projects_monthly_priority
  foreign key (linked_monthly_priority_id)
  references public.monthly_priorities(id)
  on delete set null;
