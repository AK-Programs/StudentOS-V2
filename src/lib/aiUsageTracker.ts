import { useState, useEffect, useCallback } from 'react';

export interface AIUsageStatus {
  used: number;
  limit: number;
  remaining: number;
  nextAvailableInMinutes: number | null;
  percentage: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
}

const DEFAULT_ROLE_LIMITS: Record<string, number> = {
  student: 30,
  teacher: 75,
  coordinator: 100,
  admin: 150,
  super_admin: 150
};

export async function fetchAiUsageStatus(userId: string, role?: string): Promise<AIUsageStatus> {
  const normRole = (role || 'student').toLowerCase();
  const fallbackLimit = DEFAULT_ROLE_LIMITS[normRole] || 30;

  try {
    const res = await fetch(`/api/ai/usage-status?userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(normRole)}`);
    if (!res.ok) throw new Error('Failed to fetch status');
    const data = await res.json();
    const used = Number(data.used) || 0;
    const limit = Number(data.limit) || fallbackLimit;
    const remaining = Math.max(0, limit - used);
    const percentage = Math.min(100, Math.round((used / limit) * 100));

    return {
      used,
      limit,
      remaining,
      nextAvailableInMinutes: data.nextAvailableInMinutes || null,
      percentage,
      isNearLimit: percentage >= 80,
      isAtLimit: used >= limit
    };
  } catch (err) {
    return {
      used: 0,
      limit: fallbackLimit,
      remaining: fallbackLimit,
      nextAvailableInMinutes: null,
      percentage: 0,
      isNearLimit: false,
      isAtLimit: false
    };
  }
}

export function useAiBuddyUsage(userId?: string, role?: string) {
  const [status, setStatus] = useState<AIUsageStatus>({
    used: 0,
    limit: DEFAULT_ROLE_LIMITS[(role || 'student').toLowerCase()] || 30,
    remaining: 30,
    nextAvailableInMinutes: null,
    percentage: 0,
    isNearLimit: false,
    isAtLimit: false
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const result = await fetchAiUsageStatus(userId, role);
    setStatus(result);
    setLoading(false);
  }, [userId, role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, refresh, loading };
}
