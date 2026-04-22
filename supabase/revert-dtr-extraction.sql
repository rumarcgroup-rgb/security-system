drop trigger if exists dtr_submissions_reset_extraction_after_change on public.dtr_submissions;
drop function if exists public.reset_dtr_extraction_after_dtr_change();
drop function if exists public.review_dtr_extraction(uuid, jsonb, text);
drop table if exists public.dtr_extractions cascade;
