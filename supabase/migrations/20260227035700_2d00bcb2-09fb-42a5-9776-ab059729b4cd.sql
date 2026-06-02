CREATE POLICY "Admin RH can update profiles in tenant"
ON public.profiles FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin_rh'::app_role))
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin_rh'::app_role));

CREATE POLICY "Admin RH can delete profiles in tenant"
ON public.profiles FOR DELETE TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin_rh'::app_role));