'use client';
import { useAuth } from '@/app/providers';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProfileRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push(`/profile/${user.id}`);
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return <div className="text-center font-black text-4xl mt-20 italic">ПЕРЕНАПРАВЛЕНИЕ...</div>;
}
