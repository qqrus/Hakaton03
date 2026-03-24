'use client';

import { useEffect, useState } from 'react';
import { eventApi } from '@/lib/api';
import { PlusCircle, CheckCircle, Clock, Edit2, QrCode, X } from 'lucide-react';

export default function OrganizerDashboard({ user }: { user: any }) {
  const [events, setEvents] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [basePoints, setBasePoints] = useState(10);
  const [category, setCategory] = useState('IT');
  const [prizes, setPrizes] = useState('');
  const [participationsMap, setParticipationsMap] = useState<Record<number, any[]>>({});
  const [editingEvent, setEditingEvent] = useState<any>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const res = await eventApi.getAll();
      const orgEvents = res.data.filter((e: any) => e.organizer_id === user.id || user.role === 'admin');
      setEvents(orgEvents);
      orgEvents.forEach((ev: any) => loadParticipants(ev.id));
    } catch (e) {
      console.error(e);
    }
  };

  const loadParticipants = async (eventId: number) => {
    try {
      const res = await eventApi.getParticipants(eventId);
      setParticipationsMap(prev => ({ ...prev, [eventId]: res.data }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await eventApi.create({
        title,
        description,
        base_points: basePoints,
        difficulty_coeff: 1.0,
        category,
        prizes,
      });
      alert('Событие создано!');
      setTitle('');
      setDescription('');
      loadEvents();
    } catch (error: any) {
      alert(error.response?.data?.detail || "Ошибка");
    }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await eventApi.updateEvent(editingEvent.id, {
        title: editingEvent.title,
        description: editingEvent.description,
        base_points: editingEvent.base_points,
        difficulty_coeff: editingEvent.difficulty_coeff || 1.0,
        category: editingEvent.category,
        prizes: editingEvent.prizes,
      });
      alert('Событие обновлено!');
      setEditingEvent(null);
      loadEvents();
    } catch (error: any) {
      alert(error.response?.data?.detail || "Ошибка");
    }
  };

  const handleConfirm = async (eventId: number, userId: number) => {
    try {
      await eventApi.confirmParticipation(eventId, userId);
      alert('Подтверждено!');
      loadParticipants(eventId);
    } catch (e: any) {
      alert(e.response?.data?.detail || "Ошибка");
    }
  };

  return (
    <div className="space-y-8">
      <header className="border-b-8 border-black pb-6 mb-8">
        <h2 className="text-5xl font-black uppercase italic drop-shadow-[4px_4px_0_rgba(244,114,182,1)] tracking-tight">Панель Организатора</h2>
        <p className="text-xl font-bold bg-black text-white px-3 py-1 inline-block mt-4 border-2 border-black transform 1rotate-1">Привет, {user.name}!</p>
      </header>

      <section className="grid lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-cyan-300 border-4 border-black p-6 shadow-[8px_8px_0_0_#000]">
            <h3 className="text-2xl font-black uppercase mb-6 flex items-center gap-2 border-b-4 border-black pb-2 inline-flex"><PlusCircle /> Создать Мероприятие</h3>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="font-bold uppercase text-sm mb-1 block">Название</label>
                <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-pink-400" />
              </div>
              <div>
                <label className="font-bold uppercase text-sm mb-1 block">Описание</label>
                <textarea required value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-pink-400" rows={3}></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold uppercase text-sm mb-1 block">Базовые Баллы</label>
                  <input type="number" required value={basePoints} onChange={(e) => setBasePoints(Number(e.target.value))} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-pink-400" />
                </div>
                <div>
                  <label className="font-bold uppercase text-sm mb-1 block">Категория</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-pink-400">
                    <option>IT</option>
                    <option>Медиа</option>
                    <option>Лидерство</option>
                    <option>Волонтерство</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-bold uppercase text-sm mb-1 block">Призы / Бонусы</label>
                <input placeholder="Мерч, Стажировка..." value={prizes} onChange={(e) => setPrizes(e.target.value)} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-pink-400" />
              </div>
              <button type="submit" className="w-full py-3 text-xl font-black border-4 border-black bg-pink-400 text-black hover:bg-black hover:text-white transition-colors">
                СОЗДАТЬ
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <h3 className="text-3xl font-black uppercase mb-6 bg-yellow-400 text-black px-4 py-2 inline-block border-4 border-black shadow-[4px_4px_0_0_#000] -rotate-1">Ваши Мероприятия и Заявки</h3>
          <div className="space-y-6">
            {events.length === 0 && <p className="font-bold text-xl bg-white border-4 border-black p-4">У вас пока нет мероприятий.</p>}
            {events.map((event: any) => (
              <div key={event.id} className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000]">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-2xl font-black uppercase">{event.title}</h4>
                    <span className="bg-cyan-300 text-black font-bold uppercase text-xs px-2 py-1 border-2 border-black inline-block mt-2 mr-2">{event.category}</span>
                    <span className="bg-pink-300 text-black font-bold uppercase text-xs px-2 py-1 border-2 border-black inline-block mt-2">Баллов: {event.base_points}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingEvent(event)} className="p-2 border-2 border-black bg-yellow-400 hover:bg-black hover:text-white transition-all shadow-[2px_2px_0_0_#000]">
                      <Edit2 size={20} />
                    </button>
                    <div className="relative group">
                       <button className="p-2 border-2 border-black bg-cyan-400 hover:bg-black hover:text-white transition-all shadow-[2px_2px_0_0_#000]">
                         <QrCode size={20} />
                       </button>
                       <div className="hidden group-hover:block absolute right-0 top-12 z-50 bg-white border-4 border-black p-2 shadow-[8px_8px_0_0_#000]">
                         <img src={eventApi.getEventQrUrl(event.id)} alt="QR" className="w-32 h-32" />
                         <p className="text-[10px] font-black text-center mt-2 uppercase">QR-пропуск</p>
                       </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 border-t-4 border-black pt-4">
                  <h5 className="font-black uppercase mb-3">Заявки участников ({participationsMap[event.id]?.length || 0}):</h5>
                  <div className="space-y-3">
                    {participationsMap[event.id]?.length === 0 && <span className="text-sm font-bold text-zinc-500">Пока нет заявок.</span>}
                    {participationsMap[event.id]?.map((p: any) => (
                      <div key={p.user_id} className="flex items-center justify-between bg-zinc-100 border-2 border-black p-3">
                        <div>
                          <p className="font-bold text-lg">{p.name}</p>
                          <p className="text-xs font-bold text-zinc-500">{p.email}</p>
                        </div>
                        {p.status === 'pending' ? (
                          <button 
                            onClick={() => handleConfirm(event.id, p.user_id)}
                            className="bg-yellow-400 border-2 border-black font-black uppercase px-4 py-2 hover:bg-black hover:text-white transition-colors"
                          >
                            Подтвердить
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-green-600 font-black uppercase text-sm">
                            <CheckCircle size={18} /> Подтвержден
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </section>

      {/* Edit Modal */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white border-8 border-black p-8 max-w-2xl w-full shadow-[16px_16px_0_0_#000] relative">
            <button onClick={() => setEditingEvent(null)} className="absolute -top-4 -right-4 bg-red-500 text-white border-4 border-black p-2 hover:bg-black transition-colors">
              <X size={24} />
            </button>
            <h3 className="text-3xl font-black uppercase mb-6 flex items-center gap-2 border-b-4 border-black pb-2 italic">Редактировать Событие</h3>
            <form onSubmit={handleUpdateEvent} className="space-y-4">
              <div>
                <label className="font-bold uppercase text-sm mb-1 block">Название</label>
                <input required value={editingEvent.title} onChange={(e) => setEditingEvent({...editingEvent, title: e.target.value})} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-yellow-400" />
              </div>
              <div>
                <label className="font-bold uppercase text-sm mb-1 block">Описание</label>
                <textarea required value={editingEvent.description} onChange={(e) => setEditingEvent({...editingEvent, description: e.target.value})} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-yellow-400" rows={3}></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold uppercase text-sm mb-1 block">Базовые Баллы</label>
                  <input type="number" required value={editingEvent.base_points} onChange={(e) => setEditingEvent({...editingEvent, base_points: Number(e.target.value)})} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-yellow-400" />
                </div>
                <div>
                  <label className="font-bold uppercase text-sm mb-1 block">Категория</label>
                  <select value={editingEvent.category} onChange={(e) => setEditingEvent({...editingEvent, category: e.target.value})} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-yellow-400">
                    <option>IT</option>
                    <option>Медиа</option>
                    <option>Лидерство</option>
                    <option>Волонтерство</option>
                    <option>Экология</option>
                    <option>Спорт</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-bold uppercase text-sm mb-1 block">Призы / Бонусы</label>
                <input placeholder="Мерч, Стажировка..." value={editingEvent.prizes || ''} onChange={(e) => setEditingEvent({...editingEvent, prizes: e.target.value})} className="w-full border-4 border-black p-2 font-bold focus:outline-none focus:ring-4 focus:ring-yellow-400" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 py-4 text-xl font-black border-4 border-black bg-yellow-400 text-black hover:bg-black hover:text-white transition-colors shadow-[8px_8px_0_0_#000]">
                  СОХРАНИТЬ ИЗМЕНЕНИЯ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
