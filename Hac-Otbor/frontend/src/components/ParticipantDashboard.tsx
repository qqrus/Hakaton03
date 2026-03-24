'use client';

import { useEffect, useState } from 'react';
import { eventApi, authApi } from '@/lib/api';
import { motion } from 'framer-motion';
import { Calendar, Zap, Activity, QrCode, UserCog, User, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function ParticipantDashboard({ user, refreshUser }: { user: any, refreshUser: () => void }) {
  const [events, setEvents] = useState([]);
  const [userEvents, setUserEvents] = useState([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: user.name || '',
    city: user.city || '',
    education: user.education || '',
    work_place: user.work_place || '',
    telegram: user.telegram || ''
  });
  
  const chartData = [
    { name: 'Нед 1', points: Math.max(0, (user?.rating?.total_points || 300) - 150) },
    { name: 'Нед 2', points: Math.max(0, (user?.rating?.total_points || 300) - 50) },
    { name: 'Нед 3', points: Math.max(0, (user?.rating?.total_points || 300) - 20) },
    { name: 'Сейчас', points: user?.rating?.total_points || 0 },
  ];

  useEffect(() => {
    eventApi.getAll().then(res => setEvents(res.data)).catch(console.error);
    eventApi.getUserEvents(user.id).then(res => setUserEvents(res.data)).catch(console.error);
  }, [user.id]);

  const refreshEvents = () => {
    eventApi.getUserEvents(user.id).then(res => setUserEvents(res.data)).catch(console.error);
  };

  const handleJoin = async (id: number) => {
    try {
      await eventApi.join(id);
      await refreshUser();
      refreshEvents();
      alert("Заявка отправлена организатору!");
    } catch (e: any) {
      alert(e.response?.data?.detail || "Ошибка участия. Возможно, вы уже подали заявку или достигли лимита (макс. 3).");
    }
  };

  const handleCancel = async (eventId: number) => {
    if (!confirm("Вы уверены, что хотите отозвать заявку?")) return;
    try {
      await eventApi.cancelParticipation(eventId);
      refreshEvents();
      alert("Заявка отозвана");
    } catch (e: any) {
      alert("Ошибка отмены заявки");
    }
  };

  const handleUpdateProfile = async (e: any) => {
    e.preventDefault();
    try {
      await authApi.updateMe(profileForm);
      await refreshUser();
      setIsEditingProfile(false);
      alert("Профиль обновлен!");
    } catch (e: any) {
      alert("Ошибка обновления профиля");
    }
  };

  const nextLevelThreshold = user.rating.level === "Elite" ? 1000 : user.rating.level === "Leader" ? 400 : user.rating.level === "Activist" ? 150 : 50;
  const progressPercent = Math.min(100, Math.round((user.rating.total_points / nextLevelThreshold) * 100));

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end border-b-8 border-black pb-6 mb-8">
        <div>
          <h2 className="text-5xl font-black uppercase italic drop-shadow-[4px_4px_0_rgba(234,179,8,1)] tracking-tight">Дэшборд Участника</h2>
          <div className="flex items-center mt-4">
            <p className="text-xl font-bold bg-black text-white px-3 py-1 inline-block border-2 border-black transform -rotate-1">Привет, {user.name}!</p>
            <button 
              onClick={() => setIsEditingProfile(true)}
              className="ml-4 flex items-center gap-1 text-sm font-black bg-pink-400 border-2 border-black px-3 py-1 hover:bg-black hover:text-white transition-colors rotate-2 shadow-[2px_2px_0_0_#000]">
              <UserCog size={16} /> РЕДАКТИРОВАТЬ
            </button>
          </div>
        </div>
        <div className="flex gap-4">
           <div className="bg-yellow-400 border-4 border-black p-4 flex flex-col items-center shadow-[4px_4px_0_0_#000]">
              <span className="block text-sm font-black uppercase tracking-widest">Баллы</span>
              <span className="text-4xl font-black">{user.rating.total_points}</span>
           </div>
           {user.rating.rank && (
             <div className="bg-white border-4 border-black p-4 flex flex-col items-center shadow-[4px_4px_0_0_#000]">
                <span className="block text-sm font-black uppercase tracking-widest">Место</span>
                <span className="text-4xl font-black">#{user.rating.rank}</span>
             </div>
           )}
        </div>
      </header>

      <section className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000]">
            <h3 className="text-2xl font-black uppercase mb-6 flex items-center gap-2 border-b-4 border-black pb-2 inline-flex"><Activity /> Динамика Баллов</h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#000" vertical={false} />
                  <XAxis dataKey="name" stroke="#000" tick={{fontFamily: 'inherit', fontWeight: 'bold'}} />
                  <YAxis stroke="#000" tick={{fontFamily: 'inherit', fontWeight: 'bold'}} />
                  <Tooltip contentStyle={{border: '4px solid black', borderRadius: 0, fontWeight: 'bold', backgroundColor: '#fff', boxShadow: '4px 4px 0 0 #000'}} cursor={{stroke: 'black', strokeWidth: 2}} />
                  <Area type="monotone" dataKey="points" stroke="#000" strokeWidth={4} fill="#facc15" fillOpacity={1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h3 className="text-3xl font-black uppercase mb-6 bg-pink-400 text-black px-4 py-2 inline-block border-4 border-black shadow-[4px_4px_0_0_#000] -rotate-1">Доступные события</h3>
            <div className="grid md:grid-cols-2 gap-6">
              {events.map((event: any, i) => (
                <motion.div 
                  key={event.id}
                  whileHover={{ y: -5, x: -5, boxShadow: "12px 12px 0px 0px rgba(0,0,0,1)" }}
                  className="bg-white border-4 border-black shadow-[6px_6px_0_0_#000] flex flex-col justify-between p-6 transition-all"
                  style={{ minHeight: '220px' }}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4 border-b-4 border-black pb-2">
                      <div className="bg-black text-white p-2">
                        <Calendar size={24} />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="relative group">
                          <button className="p-1 border-2 border-black bg-cyan-300 hover:bg-black hover:text-white transition-all shadow-[2px_2px_0_0_#000]">
                            <QrCode size={18} />
                          </button>
                          <div className="hidden group-hover:block absolute right-0 top-10 z-50 bg-white border-4 border-black p-2 shadow-[8px_8px_0_0_#000] w-32">
                            <img src={eventApi.getEventQrUrl(event.id)} alt="QR" className="w-full" />
                          </div>
                        </div>
                        <span className="font-black text-3xl text-pink-500 drop-shadow-[1px_1px_0_#000]">+{event.base_points * event.difficulty_coeff}</span>
                      </div>
                    </div>
                    <h4 className="text-xl font-black mb-2 uppercase leading-tight tracking-tight">{event.title}</h4>
                    <p className="font-bold text-sm mb-6 line-clamp-2 text-zinc-600 border-l-4 border-pink-400 pl-2">{event.description}</p>
                  </div>
                  <button 
                    onClick={() => handleJoin(event.id)}
                    className="w-full py-3 text-xl font-black border-4 border-black bg-yellow-400 text-black hover:bg-black hover:text-white mt-auto transition-colors focus:ring-4 focus:ring-pink-400"
                  >
                    ПОДАТЬ ЗАЯВКУ
                  </button>
                </motion.div>
              ))}
            </div>
          </div>

          <div>
             <h3 className="text-3xl font-black uppercase mb-6 bg-cyan-300 text-black px-4 py-2 inline-block border-4 border-black shadow-[4px_4px_0_0_#000] rotate-1">Мои участия</h3>
             <div className="bg-white border-4 border-black shadow-[8px_8px_0_0_#000] overflow-hidden">
                <table className="w-full border-collapse">
                   <thead className="bg-black text-white text-left text-xs uppercase font-black tracking-widest">
                      <tr>
                         <th className="p-4">Событие</th>
                         <th className="p-4 text-center">Статус</th>
                         <th className="p-4 text-center">Баллы</th>
                         <th className="p-4 text-center">Действие</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y-4 divide-black">
                      {userEvents.length === 0 ? (
                        <tr>
                           <td colSpan={4} className="p-8 text-center font-bold text-zinc-500 italic">У вас пока нет заявок на участие</td>
                        </tr>
                      ) : (
                        userEvents.map((ev: any) => (
                           <tr key={ev.id} className="hover:bg-zinc-50 transition-colors font-bold">
                              <td className="p-4">{ev.title}</td>
                              <td className="p-4 text-center">
                                 <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs border-2 border-black ${ev.status === 'confirmed' ? 'bg-green-400' : 'bg-yellow-200'}`}>
                                    {ev.status === 'confirmed' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                                    {ev.status === 'confirmed' ? 'ГЕРОЙ' : 'ЖДЕМ'}
                                 </span>
                              </td>
                              <td className="p-4 text-center text-pink-500">
                                 {ev.status === 'confirmed' ? `+${ev.base_points * ev.difficulty_coeff}` : '—'}
                              </td>
                              <td className="p-4 text-center">
                                {ev.status === 'pending' && (
                                  <button 
                                    onClick={() => handleCancel(ev.id)}
                                    className="p-2 bg-red-400 border-2 border-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0_0_#000]"
                                    title="Отозвать заявку"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </td>
                           </tr>
                        ))
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        </div>

        <aside className="space-y-8">
          <div className="bg-cyan-400 border-4 border-black p-8 space-y-4 hover:-translate-y-2 hover:translate-x-2 transition-transform shadow-[12px_12px_0_0_#000]">
            <Zap size={56} className="fill-black text-black" />
            <div className="text-sm font-black uppercase mt-2 bg-white inline-block px-2 py-1 border-2 border-black">Твой уровень</div>
            <div className="text-5xl font-black italic tracking-tighter drop-shadow-[2px_2px_0_#fff]">{user.rating.level.toUpperCase()}</div>
            <div className="h-8 w-full bg-white border-4 border-black overflow-hidden relative">
               <div className="h-full bg-black transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <p className="font-black text-lg bg-white inline-block px-2 py-1 border-2 border-black border-dashed">
              {user.rating.total_points} / {nextLevelThreshold} 
            </p>
          </div>
          
          <div className="bg-pink-100 border-4 border-black p-6 shadow-[8px_8px_0_0_#000]">
            <h4 className="font-black mb-6 uppercase text-2xl border-b-4 border-black pb-2">Твои навыки</h4>
            <div className="flex flex-wrap gap-3">
              {['IT', 'Волонтерство', 'Лидерство', 'Аналитика', 'Медиа'].map((tag, idx) => (
                <motion.span 
                  key={tag} 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ scale: 1.1, rotate: idx % 2 === 0 ? 5 : -5 }}
                  className="px-4 py-2 bg-yellow-400 border-4 border-black font-black text-sm cursor-help hover:bg-cyan-300 transition-colors shadow-[2px_2px_0_0_#000]"
                >
                  #{tag}
                </motion.span>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[12px_12px_0_0_#000]">
            <h3 className="text-2xl font-black mb-6 uppercase border-b-4 border-black pb-2">Редактировать профиль</h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="font-bold uppercase text-xs mb-1 block">Имя</label>
                <input value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-cyan-400" required />
              </div>
              <div>
                <label className="font-bold uppercase text-xs mb-1 block">Город</label>
                <input value={profileForm.city} onChange={e => setProfileForm({...profileForm, city: e.target.value})} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-cyan-400" />
              </div>
              <div>
                <label className="font-bold uppercase text-xs mb-1 block">Образование</label>
                <input value={profileForm.education} onChange={e => setProfileForm({...profileForm, education: e.target.value})} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-cyan-400" />
              </div>
              <div>
                <label className="font-bold uppercase text-xs mb-1 block">Место работы</label>
                <input value={profileForm.work_place} onChange={e => setProfileForm({...profileForm, work_place: e.target.value})} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-cyan-400" />
              </div>
              <div>
                <label className="font-bold uppercase text-xs mb-1 block">Telegram</label>
                <input value={profileForm.telegram} onChange={e => setProfileForm({...profileForm, telegram: e.target.value})} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-cyan-400" />
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setIsEditingProfile(false)} className="flex-1 py-3 font-black uppercase border-4 border-black bg-zinc-200 hover:bg-black hover:text-white transition-colors">ОТМЕНА</button>
                <button type="submit" className="flex-1 py-3 font-black uppercase border-4 border-black bg-pink-400 hover:bg-black hover:text-white transition-colors shadow-[4px_4px_0_0_#000]">СОХРАНИТЬ</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
