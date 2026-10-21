-- Kesit: "Hesabımı sil"
--
-- Supabase → SQL Editor → New query → bu dosyanın tamamını yapıştır → Run. Bir kez çalıştırman yeter.
--
-- Giriş yapmış kullanıcı yalnızca KENDİ hesabını silebilir: işlev, isteği yapanın kimliğini
-- (auth.uid()) kullanır, dışarıdan kimlik almaz. Giriş yapmamış biri çağıramaz.

create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
