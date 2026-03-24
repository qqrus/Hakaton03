'use client';

import { useAuth } from '@/app/providers';
import ParticipantDashboard from '@/components/ParticipantDashboard';
import OrganizerDashboard from '@/components/OrganizerDashboard';

export default function Dashboard() {
  const { user, refreshUser, loading } = useAuth();

  if (loading) return <div className="p-20 text-center font-black text-2xl animate-pulse">ЗАРЯЖАЕМ ДАННЫЕ...</div>;
  if (!user) return <div className="p-20 text-center font-black text-2xl">Пожалуйста, войдите в систему.</div>;

  if (user.role === 'organizer' || user.role === 'admin') {
    return <OrganizerDashboard user={user} />;
  }

  return <ParticipantDashboard user={user} refreshUser={refreshUser} />;
}
