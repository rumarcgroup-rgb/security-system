export function getSupervisorScopeLabel(profile) {
  if (!profile?.location) return "No area assigned";
  return profile.branch ? `${profile.location} / ${profile.branch}` : profile.location;
}

export function matchesSupervisorScope(target, supervisorProfile) {
  if (!supervisorProfile?.location) return false;

  const location = target?.location ?? target?.profiles?.location ?? null;
  const branch = target?.branch ?? target?.profiles?.branch ?? null;

  if (location !== supervisorProfile.location) return false;
  if (supervisorProfile.branch && branch !== supervisorProfile.branch) return false;
  return true;
}

export function isScopedEmployee(profile, supervisorProfile) {
  if (!profile || profile.role === "admin") return false;
  return matchesSupervisorScope(profile, supervisorProfile);
}
