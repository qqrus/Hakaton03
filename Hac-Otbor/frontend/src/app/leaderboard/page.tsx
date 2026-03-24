'use client';

import { useEffect, useState } from 'react';
import { ratingApi } from '@/lib/api';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp } from 'lucide-react';

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    ratingApi.getLeaderboard().then(res => setLeaders(res.data)).catch(console.error);
  }, []);

  const getCardColor = (index: number) => {
    if (index === 0) return 'bg-yellow-400';
    if (index === 1) return 'bg-zinc-200';
    if (index === 2) return 'bg-orange-300';
    return 'bg-white';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 py-8">
      <div className="text-center space-y-6">
        <h2 className="text-6xl sm:text-8xl font-black tracking-tighter uppercase italic drop-shadow-[4px_4px_0_#000] text-white" style={{ WebkitTextStroke: '2px black', textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>Глобальный Топ</h2>
        <motion.div 
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-xl font-black bg-black text-yellow-400 inline-flex items-center gap-3 px-6 py-3 border-4 border-white shadow-[4px_4px_0_0_#000]"
        >
          <TrendingUp /> ОБНОВЛЯЕТСЯ В РЕАЛЬНОМ ВРЕМЕНИ
        </motion.div>
      </div>

      <div className="space-y-6">
        {leaders.map((user: any, i) => (
          <motion.div 
            key={i}
            initial={{ x: i % 2 === 0 ? -100 : 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
            whileHover={{ scale: 1.02, translateX: 10 }}
            className={`flex items-center justify-between p-4 sm:p-6 border-4 border-black shadow-[8px_8px_0_0_#000] relative overflow-hidden ${getCardColor(i)}`}
          >
            {i === 0 && <div className="absolute top-0 right-0 w-32 h-32 bg-white/30 rotate-45 transform translate-x-10 -translate-y-10" />}

            <div className="flex items-center gap-6 z-10">
               <div className={`w-16 h-16 border-4 border-black bg-black text-white flex items-center justify-center font-black text-3xl shadow-[4px_4px_0_0_rgba(255,255,255,0.8)]`}>
                  #{i + 1}
               </div>
               <div>
                  <h4 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">{user.name}</h4>
                  <span className="px-3 py-1 bg-black text-white text-[10px] sm:text-xs font-black uppercase mt-1 inline-block border-2 border-black">
                     {user.level}
                  </span>
               </div>
            </div>
            
            <div className="flex items-center gap-4 sm:gap-8 z-10 bg-white/50 px-4 py-2 border-4 border-black">
               {i < 3 && <Trophy className={i === 0 ? 'text-yellow-600' : i === 1 ? 'text-zinc-600' : 'text-orange-600'} size={32} strokeWidth={3} />}
               <div className="text-3xl sm:text-5xl font-black">
                 {user.points} 
                 <span className="text-sm block sm:inline sm:ml-2 font-bold uppercase mt-1 sm:mt-0 opacity-80">БАЛЛОВ</span>
               </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
