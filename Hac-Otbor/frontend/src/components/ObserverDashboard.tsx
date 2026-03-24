'use client';

import { useEffect, useState } from 'react';
import { authApi, ratingApi } from '@/lib/api';
import { Users, BarChart3, Download, Zap, BrainCircuit } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis
} from 'recharts';

export default function ObserverDashboard({ user }: { user: any }) {
    const [participants, setParticipants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [aiSummary, setAiSummary] = useState<Record<number, any>>({});
    const [loadingAi, setLoadingAi] = useState<Record<number, boolean>>({});

    useEffect(() => {
        loadParticipants();
    }, []);

    const loadParticipants = async () => {
        try {
            const res = await authApi.getUsers();
            // Sort by points descending
            const sorted = res.data.sort((a: any, b: any) =>
                (b.rating?.total_points || 0) - (a.rating?.total_points || 0)
            );
            setParticipants(sorted);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPdf = (userId: number, userName: string) => {
        const url = `${process.env.NEXT_PUBLIC_API_URL || '/api'}/users/${userId}/pdf`;
        window.open(url, '_blank');
    };

    const loadAiSummary = async (userId: number) => {
        if (aiSummary[userId]) return; // already loaded

        setLoadingAi(prev => ({ ...prev, [userId]: true }));
        try {
            const res = await ratingApi.getAiSummary(userId);
            console.debug("Raw AI summary response:", res.data);

            // The backend returns {"summary": {"summary": "...", "stats": [...]}}
            let parsedData = res.data?.summary || res.data;

            if (typeof parsedData === 'string') {
                try {
                    parsedData = JSON.parse(parsedData);
                } catch (err) {
                    parsedData = { summary: parsedData, stats: [] };
                }
            }

            // Normalize the object structure
            if (typeof parsedData === 'object' && parsedData !== null) {
                if (!parsedData.summary) {
                    // Try to find any text field
                    const textContent = Object.values(parsedData).find(v => typeof v === 'string') || "Нет текстового описания";
                    parsedData.summary = textContent;
                }
                if (!parsedData.stats || !Array.isArray(parsedData.stats)) {
                    // Try to find any array field
                    const arrayContent = Object.values(parsedData).find(v => Array.isArray(v)) || [];
                    parsedData.stats = arrayContent;
                }
            } else {
                parsedData = { summary: "Не удалось распознать ответ от AI", stats: [] };
            }

            setAiSummary(prev => ({ ...prev, [userId]: parsedData }));
        } catch (e) {
            console.error("AI Summary error:", e);
            setAiSummary(prev => ({ ...prev, [userId]: { summary: "Ошибка загрузки резюме", stats: [] } }));
        } finally {
            setLoadingAi(prev => ({ ...prev, [userId]: false }));
        }
    };

    if (loading) return <div className="p-10 font-black text-xl animate-pulse">Загрузка данных...</div>;

    // Analytics
    const totalParticipants = participants.length;
    const avgScore = totalParticipants > 0
        ? Math.round(participants.reduce((acc, p) => acc + (p.rating?.total_points || 0), 0) / totalParticipants)
        : 0;

    // Chart data: Distribution of levels
    const levelCounts = participants.reduce((acc: any, p: any) => {
        const lvl = p.rating?.level || 'Novice';
        acc[lvl] = (acc[lvl] || 0) + 1;
        return acc;
    }, {});

    const chartData = Object.keys(levelCounts).map(level => ({
        name: level,
        count: levelCounts[level]
    }));

    return (
        <div className="space-y-8">
            <header className="border-b-8 border-black pb-6 mb-8 flex justify-between items-end">
                <div>
                    <h2 className="text-5xl font-black uppercase italic drop-shadow-[4px_4px_0_rgba(168,85,247,1)] tracking-tight">Панель HR</h2>
                    <p className="text-xl font-bold bg-black text-white px-3 py-1 inline-block mt-4 border-2 border-black transform -rotate-1">Наблюдатель: {user.name}</p>
                </div>
            </header>

            {/* Analytics Section */}
            <section className="grid lg:grid-cols-3 gap-8">
                <div className="bg-purple-400 border-4 border-black p-6 shadow-[8px_8px_0_0_#000] flex flex-col items-center justify-center">
                    <Users size={48} className="mb-2" />
                    <span className="text-xl font-black uppercase">Всего кандидатов</span>
                    <span className="text-6xl font-black">{totalParticipants}</span>
                </div>
                <div className="bg-yellow-400 border-4 border-black p-6 shadow-[8px_8px_0_0_#000] flex flex-col items-center justify-center">
                    <Zap size={48} className="mb-2" />
                    <span className="text-xl font-black uppercase">Средний балл</span>
                    <span className="text-6xl font-black">{avgScore}</span>
                </div>
                <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000]">
                    <h3 className="text-lg font-black uppercase mb-4 text-center border-b-4 border-black pb-2">Уровни кандидатов</h3>
                    <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#000" />
                                <XAxis dataKey="name" stroke="#000" tick={{ fontWeight: 'bold' }} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ border: '4px solid black', borderRadius: 0, fontWeight: 'bold' }} />
                                <Bar dataKey="count" fill="#A855F7" stroke="#000" strokeWidth={3} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </section>

            {/* Participants List */}
            <section className="bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000]">
                <h3 className="text-3xl font-black uppercase mb-6 flex items-center gap-2">
                    <BarChart3 size={32} /> База кандидатов
                </h3>

                <div className="space-y-4">
                    {participants.map((p, idx) => (
                        <div key={p.id} className="border-4 border-black p-4 flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50 hover:bg-gray-100 transition-colors">
                            <div className="mb-4 md:mb-0">
                                <h4 className="text-2xl font-black">{idx + 1}. {p.name}</h4>
                                <div className="flex gap-4 text-sm font-bold text-gray-600 mt-2">
                                    <span>Email: {p.email}</span>
                                    {p.city && <span>Город: {p.city}</span>}
                                    {p.education && <span>ВУЗ: {p.education}</span>}
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                                <div className="flex gap-4 items-center">
                                    <div className="bg-yellow-300 border-2 border-black px-3 py-1 font-black shadow-[2px_2px_0_0_#000]">
                                        Баллы: {p.rating?.total_points || 0}
                                    </div>
                                    <div className="bg-blue-300 border-2 border-black px-3 py-1 font-black shadow-[2px_2px_0_0_#000]">
                                        {p.rating?.level || 'Novice'}
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-2 w-full md:w-auto">
                                    <button
                                        onClick={() => loadAiSummary(p.id)}
                                        className="flex-1 md:flex-none flex justify-center items-center gap-2 bg-pink-400 border-2 border-black px-3 py-2 font-black hover:bg-black hover:text-white transition-colors"
                                    >
                                        <BrainCircuit size={16} /> AI Резюме
                                    </button>
                                    <button
                                        onClick={() => handleDownloadPdf(p.id, p.name)}
                                        className="flex-1 md:flex-none flex justify-center items-center gap-2 bg-green-400 border-2 border-black px-3 py-2 font-black hover:bg-black hover:text-white transition-colors"
                                    >
                                        <Download size={16} /> PDF Отчет
                                    </button>
                                </div>
                            </div>

                            {/* AI Summary Panel */}
                            {(aiSummary[p.id] || loadingAi[p.id]) && (
                                <div className="w-full mt-4 p-4 border-4 border-black bg-pink-50 shadow-[4px_4px_0_0_#000]">
                                    <h5 className="text-xl font-black flex items-center gap-2 mb-4 border-b-2 border-black pb-2">
                                        <BrainCircuit size={24} /> AI Анализ Кандидата
                                    </h5>
                                    {loadingAi[p.id] ? (
                                        <div className="flex items-center gap-3 text-pink-600">
                                            <div className="w-4 h-4 bg-pink-600 rounded-full animate-ping"></div>
                                            <span className="animate-pulse font-bold text-lg">Нейросеть генерирует детальный профиль...</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col lg:flex-row gap-6">
                                            <div className="flex-1">
                                                <p className="whitespace-pre-wrap font-medium text-gray-800 leading-relaxed text-lg">
                                                    {aiSummary[p.id]?.summary || "Нет данных"}
                                                </p>
                                            </div>

                                            {aiSummary[p.id]?.stats && aiSummary[p.id].stats.length > 0 && (
                                                <div className="w-full lg:w-1/3 bg-white border-2 border-black p-2 h-64">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={aiSummary[p.id].stats}>
                                                            <PolarGrid stroke="#000" />
                                                            <PolarAngleAxis dataKey="name" tick={{ fill: '#000', fontWeight: 'bold', fontSize: 12 }} />
                                                            <PolarRadiusAxis angle={30} domain={[0, 100]} />
                                                            <Radar name="Навыки" dataKey="value" stroke="#000" strokeWidth={2} fill="#ec4899" fillOpacity={0.6} />
                                                            <Tooltip contentStyle={{ border: '2px solid black', borderRadius: 0, fontWeight: 'bold' }} />
                                                        </RadarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {participants.length === 0 && (
                        <p className="font-bold text-gray-500 italic">Нет зарегистрированных кандидатов.</p>
                    )}
                </div>
            </section>
        </div>
    );
}
