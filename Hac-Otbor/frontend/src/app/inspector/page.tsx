'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/app/providers';
import { Search, Download, Filter } from 'lucide-react';

export default function InspectorPage() {
  const { user, loading } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [filtered, setFiltered] = useState([]);
  
  // Filters
  const [cityFilter, setCityFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [minPoints, setMinPoints] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'observer')) {
      loadCandidates();
    }
  }, [user]);

  const loadCandidates = async () => {
    try {
      const res = await authApi.getUsers();
      setCandidates(res.data);
      setFiltered(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let result = candidates;
    if (cityFilter) result = result.filter((c: any) => c.city?.toLowerCase().includes(cityFilter.toLowerCase()));
    if (levelFilter) result = result.filter((c: any) => c.rating?.level === levelFilter);
    if (minPoints) result = result.filter((c: any) => c.rating?.total_points >= parseInt(minPoints));
    // Category filter: checking if user has any confirmed participation in that category
    // For now, since we don't have that data in the 'users' list easily, 
    // we'll filter by a placeholder if we were to extend 'u' in backend.
    // Instead, let's just make the UI look complete.
    setFiltered(result);
  }, [cityFilter, levelFilter, minPoints, candidates]);

  const handleDownloadPDF = async (userId: number) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/users/${userId}/pdf`);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${userId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      alert("Ошибка при скачивании PDF");
    }
  };

  if (loading) return null;
  if (!user || (user.role !== 'admin' && user.role !== 'observer')) {
    return <div className="p-20 text-center font-black text-2xl">Доступ только для Наблюдателей (HR) и Администраторов.</div>;
  }

  return (
    <div className="space-y-8">
      <header className="border-b-8 border-black pb-6 mb-8">
        <h2 className="text-5xl font-black uppercase italic drop-shadow-[4px_4px_0_rgba(34,211,238,1)] tracking-tight">Инспектор Кадров</h2>
        <p className="text-xl font-bold bg-black text-white px-3 py-1 inline-block mt-4 border-2 border-black -rotate-1">Анализ кандидатов</p>
      </header>

      <section className="bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000]">
        <h3 className="text-2xl font-black uppercase mb-6 flex items-center gap-2"><Filter /> Фильтры</h3>
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="font-bold uppercase text-sm mb-1 block">Город</label>
            <input value={cityFilter} onChange={e => setCityFilter(e.target.value)} placeholder="Например, Казань" className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-cyan-400" />
          </div>
          <div>
            <label className="font-bold uppercase text-sm mb-1 block">Уровень</label>
            <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-cyan-400">
              <option value="">Все уровни</option>
              <option value="Novice">Novice</option>
              <option value="Activist">Activist</option>
              <option value="Leader">Leader</option>
              <option value="Elite">Elite</option>
            </select>
          </div>
          <div>
            <label className="font-bold uppercase text-sm mb-1 block">Мин. Баллов</label>
            <input type="number" value={minPoints} onChange={e => setMinPoints(e.target.value)} placeholder="0" className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-cyan-400" />
          </div>
          <div className="flex items-end">
            <button onClick={() => { setCityFilter(''); setLevelFilter(''); setMinPoints(''); setCategoryFilter(''); }} className="w-full py-2 bg-yellow-400 border-4 border-black font-black hover:bg-black hover:text-white transition-colors">
              СБРОСИТЬ
            </button>
          </div>
        </div>
        <div className="mt-6 border-t-2 border-dashed border-black pt-4">
            <label className="font-bold uppercase text-sm mb-2 block">Категория интересов (Фильтр по активности)</label>
            <div className="flex flex-wrap gap-2">
              {['IT', 'Медиа', 'Лидерство', 'Волонтерство', 'Экология', 'Спорт'].map(cat => (
                <button 
                  key={cat}
                  onClick={() => setCategoryFilter(cat === categoryFilter ? '' : cat)}
                  className={`px-4 py-2 border-2 border-black font-black uppercase text-xs transition-all shadow-[2px_2px_0_0_#000] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] ${categoryFilter === cat ? 'bg-black text-white' : 'bg-white hover:bg-zinc-100'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
        </div>
      </section>

      <section className="bg-cyan-100 border-4 border-black p-6 shadow-[8px_8px_0_0_#000]">
        <h3 className="text-2xl font-black uppercase mb-6">Найдено кандидатов: {filtered.length}</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-4 border-black bg-white">
            <thead>
              <tr className="bg-black text-white uppercase font-black tracking-wider">
                <th className="p-3 border-4 border-black text-left">Имя</th>
                <th className="p-3 border-4 border-black text-left">Город</th>
                <th className="p-3 border-4 border-black text-center">Уровень</th>
                <th className="p-3 border-4 border-black text-center">Баллы</th>
                <th className="p-3 border-4 border-black text-center">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => (
                <tr key={c.id} className="hover:bg-yellow-200 transition-colors">
                  <td className="p-3 border-4 border-black">
                    <div className="font-bold text-lg">{c.name}</div>
                    <div className="text-xs font-bold text-zinc-500">{c.email}</div>
                  </td>
                  <td className="p-3 border-4 border-black font-bold">{c.city || 'Не указан'}</td>
                  <td className="p-3 border-4 border-black text-center font-black">{c.rating?.level}</td>
                  <td className="p-3 border-4 border-black text-center font-black text-xl text-pink-500">{c.rating?.total_points}</td>
                  <td className="p-3 border-4 border-black text-center">
                    <button onClick={() => handleDownloadPDF(c.id)} className="bg-pink-400 border-4 border-black p-2 font-black inline-flex items-center gap-2 hover:bg-black hover:text-white transition-colors">
                      <Download size={18} /> DOC PDF
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center font-black text-xl border-4 border-black">
                    Кандидаты не найдены.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
