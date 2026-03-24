'use client';

import Link from 'next/link';
import { useAuth } from '@/app/providers';

export default function Navigation() {
  const { user, logout, loading } = useAuth();

  return (
    <nav className="neo-card mb-8 flex items-center justify-between py-4 bg-primary sticky top-4 z-50">
      <Link href="/" className="text-3xl font-black tracking-tighter">RAZUM 2.0</Link>
      
      <div className="space-x-8 flex items-center">
        {!loading && user && (
          <>
            {/* Common Links */}
            <Link href="/leaderboard" className="font-black uppercase hover:border-b-4 border-black transition-all">Рейтинг</Link>
            
            {/* Participant Links */}
            {user.role === 'participant' && (
              <>
                <Link href="/dashboard" className="font-black uppercase hover:border-b-4 border-black transition-all">Мои События</Link>
                <Link href={`/profile/${user.id}`} className="font-black uppercase hover:border-b-4 border-black transition-all text-pink-500">Профиль</Link>
              </>
            )}

            {/* Organizer Links */}
            {user.role === 'organizer' && (
              <>
                <Link href="/dashboard" className="font-black uppercase hover:border-b-4 border-black transition-all text-yellow-500">Мои Мероприятия</Link>
              </>
            )}

            {/* HR / Observer Links */}
            {(user.role === 'observer' || user.role === 'admin') && (
              <>
                <Link href="/inspector" className="font-black uppercase hover:border-b-4 border-black transition-all text-cyan-500 hover:text-cyan-600">Инспектор Кадров</Link>
                {user.role === 'admin' && (
                  <Link href="/dashboard" className="font-black uppercase hover:border-b-4 border-black transition-all">Управление</Link>
                )}
              </>
            )}

            <button onClick={logout} className="neo-btn bg-white">Выйти</button>
          </>
        )}

        {!loading && !user && (
          <Link href="/login" className="neo-btn bg-white">Войти</Link>
        )}
      </div>
    </nav>
  );
}
