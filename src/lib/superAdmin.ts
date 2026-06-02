export const SUPER_ADMINS = [
  { email: "mauricio@marqponto.com.br", user_id: "302dc367-1b53-4a47-af5e-d54a6b877e59" },
  { email: "mcampos.mauricio@gmail.com", user_id: "58b6321c-018b-4aa6-bf92-2aa373ed39a4" },
];

export function isSuperAdmin(profile?: { email?: string | null; user_id?: string | null } | null): boolean {
  if (!profile) return false;
  return SUPER_ADMINS.some(
    (a) =>
      a.email === profile.email?.toLowerCase() &&
      a.user_id === profile.user_id
  );
}