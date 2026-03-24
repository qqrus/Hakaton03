'use client';

import { useState, useEffect } from 'react';
import { authApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/providers';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      localStorage.setItem('token', res.data.access_token);
      await refreshUser();
      router.push('/dashboard');
    } catch (e) {
      setError("Неверный email или пароль.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 relative">
      <div className="absolute top-4 left-4 w-full h-full bg-accent border-4 border-black -z-10" style={{backgroundColor: '#eab308'}} />
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="neo-card bg-white p-10 space-y-8 shadow-[8px_8px_0_0_rgba(0,0,0,1)] border-4 border-black"
      >
        <h2 className="text-5xl font-black uppercase italic text-center drop-shadow-[2px_2px_0_rgba(234,179,8,1)]">Вход</h2>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="font-black uppercase text-sm">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border-4 border-black p-4 focus:bg-yellow-100 outline-none font-bold transition-colors"
              placeholder="admin@razum.dev"
            />
          </div>
          <div className="space-y-2">
            <label className="font-black uppercase text-sm">Пароль</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border-4 border-black p-4 focus:bg-yellow-100 outline-none font-bold transition-colors"
              placeholder="••••••••"
            />
          </div>
          
          {error && <p className="text-red-600 font-bold bg-red-100 p-2 border-2 border-red-600">{error}</p>}
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 text-2xl font-black uppercase border-4 border-black bg-black text-white hover:bg-yellow-400 hover:text-black hover:-translate-y-1 hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            {loading ? 'ЗАГРУЗКА...' : 'ВОЙТИ →'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
