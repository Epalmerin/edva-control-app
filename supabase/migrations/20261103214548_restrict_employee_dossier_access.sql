DROP POLICY "Authenticated users can read profiles" ON public.profiles;
CREATE POLICY "Active admins and RH can read employee dossiers"
ON public.profiles FOR SELECT TO authenticated
USING ((SELECT private.current_active_role()) IN ('ADMIN', 'RH'));
NOTIFY pgrst, 'reload schema';
