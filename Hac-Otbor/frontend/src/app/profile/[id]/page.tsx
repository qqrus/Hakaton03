'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ratingApi, authApi, eventApi } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Briefcase, GraduationCap, Brain, Download, UserCog, CalendarDays, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

export default function Profile() {
  const { id } = useParams();
  const { user, refreshUser } = useAuth();
  const [summary, setSummary] = useState('');
  const [aiStats, setAiStats] = useState<any[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [userEvents, setUserEvents] = useState([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '', city: '', education: '', work_place: '', telegram: ''
  });

  const isOwner = user?.id === Number(id);

  const radarData = aiStats.length > 0 ? aiStats.map((s: any) => ({
    skill: s.name,
    A: s.value,
    fullMark: 100
  })) : [
    { skill: 'IT', A: 120, fullMark: 150 },
    { skill: 'Медиа', A: 98, fullMark: 150 },
    { skill: 'Спорт', A: 86, fullMark: 150 },
    { skill: 'Экология', A: 99, fullMark: 150 },
    { skill: 'Волонтерство', A: 85, fullMark: 150 },
    { skill: 'Лидерство', A: 65, fullMark: 150 },
  ];

  const loadProfileData = () => {
    if (id) {
      authApi.getUser(Number(id))
        .then(res => {
          setProfile(res.data);
          setProfileForm({
            name: res.data.name || '',
            city: res.data.city || '',
            education: res.data.education || '',
            work_place: res.data.work_place || '',
            telegram: res.data.telegram || ''
          });
          setLoadingProfile(false);
        })
        .catch(err => {
          console.error("User not found", err);
          setLoadingProfile(false);
        });

      eventApi.getUserEvents(Number(id))
        .then(res => setUserEvents(res.data))
        .catch(console.error);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, [id]);

  const handleUpdateProfile = async (e: any) => {
    e.preventDefault();
    try {
      await authApi.updateMe(profileForm);
      await refreshUser();
      setIsEditingProfile(false);
      setProfile({ ...profile, ...profileForm });
      alert("Профиль обновлен!");
    } catch (e: any) {
      alert("Ошибка обновления профиля");
    }
  };

  const handleCancel = async (eventId: number) => {
    if (!confirm("Вы уверены, что хотите отозвать заявку?")) return;
    try {
      await eventApi.cancelParticipation(eventId);
      loadProfileData();
      alert("Заявка отозвана");
    } catch (e: any) {
      alert("Ошибка отмены заявки");
    }
  };

  const handleGenerateAI = async () => {
    setLoadingAI(true);
    setSummary('');
    try {
      const res = await ratingApi.getAiSummary(Number(id));
      console.log("Profile AI Response:", res.data);

      let parsedData = res.data?.summary || res.data;

      while (typeof parsedData === 'string') {
        try {
          const attempt = JSON.parse(parsedData);
          if (typeof attempt === 'object' && attempt !== null) {
            parsedData = attempt;
          } else {
            break;
          }
        } catch (err) {
          break;
        }
      }

      let text = "Не удалось получить текстовое описание.";

      if (typeof parsedData === 'object' && parsedData !== null) {
        if (typeof parsedData.summary === 'object' && parsedData.summary !== null) {
          text = parsedData.summary.summary || text;
          if (Array.isArray(parsedData.summary.stats)) {
            setAiStats(parsedData.summary.stats);
          }
        } else {
          text = parsedData.summary || Object.values(parsedData).find(v => typeof v === 'string') || text;
          if (Array.isArray(parsedData.stats)) {
            setAiStats(parsedData.stats);
          }
        }
      } else if (typeof parsedData === 'string') {
        text = parsedData;
      }

      if (typeof text !== 'string') {
        text = JSON.stringify(text);
      }

      // Выводим текст целиком сразу, без посимвольной анимации, чтобы избежать конфликтов React State
      setSummary(text);

    } catch (e) {
      console.error("AI Generate Error:", e);
      setSummary("Ошибка генерации. Проверьте API ключ OpenRouter.");
    } finally {
      setLoadingAI(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/users/${profile.id}/pdf`);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${profile.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      alert("Ошибка при скачивании PDF");
    }
  };

  if (loadingProfile) {
    return <div className="text-center font-black text-4xl mt-20 italic">ИЩЕМ ДАННЫЕ...</div>;
  }

  if (!profile) {
    return <div className="text-center font-black text-4xl mt-20 bg-red-400 p-10 border-4 border-black">ПОЛЬЗОВАТЕЛЬ НЕ НАЙДЕН</div>;
  }

  return (
    <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-12">
      {/* Left: Info */}
      <div className="lg:col-span-1 space-y-8">
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="bg-yellow-400 border-4 border-black text-center py-12 shadow-[8px_8px_0_0_#000] relative"
        >
          {isOwner && (
            <button
              onClick={() => setIsEditingProfile(true)}
              className="absolute top-4 right-4 bg-white border-2 border-black p-2 hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0_0_#000]"
              title="Редактировать профиль"
            >
              <UserCog size={20} />
            </button>
          )}
          <div className="w-32 h-32 border-4 border-black bg-white mx-auto mb-6 flex items-center justify-center shadow-[4px_4px_0_0_#000] rotate-3 hover:rotate-0 transition-all">
            <User size={64} strokeWidth={3} />
          </div>
          <h2 className="text-4xl font-black uppercase tracking-tighter leading-none mb-4">{profile.name}</h2>
          <span className="font-bold border-2 border-black px-4 py-2 bg-white uppercase text-sm shadow-[2px_2px_0_0_#000]">
            УЧАСТНИК #{profile.id}
          </span>
        </motion.div>

        <div className="space-y-4">
          {profile.education && (
            <div className="flex items-center gap-4 bg-white border-4 border-black p-4 shadow-[4px_4px_0_0_#000] hover:bg-zinc-100 transition-colors">
              <GraduationCap className="bg-pink-400 text-black border-2 border-black p-2" size={48} />
              <div>
                <div className="text-xs font-black uppercase text-zinc-500">Образование</div>
                <div className="font-bold text-lg">{profile.education}</div>
              </div>
            </div>
          )}
          {profile.work_place && (
            <div className="flex items-center gap-4 bg-white border-4 border-black p-4 shadow-[4px_4px_0_0_#000] hover:bg-zinc-100 transition-colors">
              <Briefcase className="bg-cyan-400 text-black border-2 border-black p-2" size={48} />
              <div>
                <div className="text-xs font-black uppercase text-zinc-500">Опыт работы</div>
                <div className="font-bold text-lg">{profile.work_place}</div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleDownloadPDF}
          className="w-full flex items-center justify-center gap-2 py-4 bg-black text-white font-black uppercase border-4 border-black hover:bg-yellow-400 hover:text-black hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000] transition-all">
          <Download size={24} /> СКАЧАТЬ PDF ОТЧЕТ
        </button>
      </div>

      {/* Right: AI & Details */}
      <div className="lg:col-span-2 space-y-8">

        {/* Radar Chart (Skills) */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000]"
        >
          <h3 className="text-2xl font-black uppercase mb-4 border-b-4 border-black pb-2">Матрица компетенций</h3>
          <div className="h-[300px] w-full flex justify-center items-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#000" strokeWidth={2} />
                <PolarAngleAxis dataKey="skill" tick={{ fill: '#000', fontWeight: 'bold', fontSize: 12, fontFamily: 'inherit' }} />
                <Radar name="Навыки" dataKey="A" stroke="#000" strokeWidth={4} fill="#f472b6" fillOpacity={0.6} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* AI Analytics */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-black text-white border-4 border-black overflow-hidden shadow-[8px_8px_0_0_#000]"
        >
          <div className="p-6 border-b-4 border-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-accent">
            <h3 className="text-2xl font-black uppercase flex items-center gap-3 text-black">
              <Brain size={32} /> AI-АНАЛИТИКА ПРОФИЛЯ
            </h3>
            {!summary && (
              <button
                onClick={handleGenerateAI}
                disabled={loadingAI}
                className="bg-white text-black font-black uppercase border-4 border-black px-6 py-2 hover:bg-yellow-400 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000] transition-all disabled:opacity-50"
              >
                {loadingAI ? 'ДУМАЮ...' : 'СФОРМИРОВАТЬ'}
              </button>
            )}
          </div>

          <div className="p-8 min-h-[250px] font-bold leading-relaxed bg-zinc-900 border-t-4 border-black text-white">
            {!summary && !loadingAI ? (
              <div className="text-zinc-500 italic text-center mt-12 text-xl font-medium">
                Нажмите "Сформировать", чтобы ИИ проанализировал <br /> достижения кандидата
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-lg">
                {summary}
                {loadingAI && <span className="animate-pulse inline-block w-3 h-6 bg-yellow-400 ml-2 align-middle" />}
              </div>
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-cyan-400 border-4 border-black p-6 shadow-[6px_6px_0_0_#000] hover:bg-yellow-400 transition-colors">
            <div className="text-xs font-black uppercase border-b-2 border-black inline-block mb-4">Текущий уровень</div>
            <div className="text-4xl sm:text-5xl font-black italic break-words leading-none">{profile.rating.level.toUpperCase()}</div>
          </div>
          <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000]">
            <div className="text-xs font-black uppercase border-b-2 border-black inline-block mb-4">Баллов всего</div>
            <div className="text-4xl sm:text-5xl font-black">{profile.rating.total_points}</div>
          </div>
        </div>

        {/* User Events Table */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000] mt-8 overflow-x-auto"
        >
          <h3 className="text-2xl font-black uppercase mb-6 flex items-center gap-3 border-b-4 border-black pb-2">
            <CalendarDays size={32} /> АКТИВНОСТЬ ({userEvents.length})
          </h3>
          <table className="w-full border-collapse border-4 border-black text-left">
            <thead className="bg-black text-white font-black uppercase tracking-wider">
              <tr>
                <th className="p-3 border-4 border-black">Мероприятие</th>
                <th className="p-3 border-4 border-black text-center">Статус</th>
                <th className="p-3 border-4 border-black text-center">Баллы</th>
                <th className="p-3 border-4 border-black text-center">Действие</th>
              </tr>
            </thead>
            <tbody>
              {userEvents.map((ev: any) => (
                <tr key={ev.id} className="hover:bg-yellow-200 transition-colors font-bold">
                  <td className="p-3 border-4 border-black">{ev.title}</td>
                  <td className="p-3 border-4 border-black text-center">
                    <span className={`px-2 py-1 text-xs items-center gap-1 inline-flex uppercase border-2 border-black ${ev.status === 'confirmed' ? 'bg-green-400' : 'bg-zinc-300'}`}>
                      {ev.status === 'confirmed' ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                      {ev.status === 'confirmed' ? 'ПОДТВЕРЖДЕНО' : 'В ОЖИДАНИИ'}
                    </span>
                  </td>
                  <td className="p-3 border-4 border-black text-center text-pink-500">
                    {ev.status === 'confirmed' ? `+${ev.base_points * ev.difficulty_coeff}` : '—'}
                  </td>
                  <td className="p-3 border-4 border-black text-center">
                    {(isOwner && ev.status === 'pending') && (
                      <button
                        onClick={() => handleCancel(ev.id)}
                        className="p-1 px-2 bg-red-400 border-2 border-black hover:bg-black hover:text-white transition-colors shadow-[2px_2px_0_0_#000]"
                        title="Отозвать заявку"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {userEvents.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center font-black text-xl border-4 border-black text-zinc-500">
                    Пока нет участий
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </motion.div>
      </div>

      {/* Edit Profile Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[12px_12px_0_0_#000]">
            <h3 className="text-2xl font-black mb-6 uppercase border-b-4 border-black pb-2">Редактировать профиль</h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="font-bold uppercase text-xs mb-1 block">Имя</label>
                <input value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-cyan-400" required />
              </div>
              <div>
                <label className="font-bold uppercase text-xs mb-1 block">Город</label>
                <input value={profileForm.city} onChange={e => setProfileForm({ ...profileForm, city: e.target.value })} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-cyan-400" />
              </div>
              <div>
                <label className="font-bold uppercase text-xs mb-1 block">Образование</label>
                <input value={profileForm.education} onChange={e => setProfileForm({ ...profileForm, education: e.target.value })} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-cyan-400" />
              </div>
              <div>
                <label className="font-bold uppercase text-xs mb-1 block">Место работы</label>
                <input value={profileForm.work_place} onChange={e => setProfileForm({ ...profileForm, work_place: e.target.value })} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-cyan-400" />
              </div>
              <div>
                <label className="font-bold uppercase text-xs mb-1 block">Telegram</label>
                <input value={profileForm.telegram} onChange={e => setProfileForm({ ...profileForm, telegram: e.target.value })} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-cyan-400" />
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
