-- Alt şube: şubenin de şubesi olabilsin (firma → şube → alt şube …)
-- ust_sube_id null ise üst seviye şube (doğrudan firmaya bağlı).
-- Üst şube silinirse alt şubeleri de silinir; işleri silinmez (is_kaydi.sube_id set null).
alter table public.sube
  add column if not exists ust_sube_id uuid references public.sube(id) on delete cascade;
create index if not exists sube_ust_sube_id_idx on public.sube(ust_sube_id);
