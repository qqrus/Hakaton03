'use client';

import { motion } from 'framer-motion';
import { Star, Trophy, Zap, Brain, Crosshair, Users, TrendingUp, Download } from 'lucide-react';
import Link from 'next/link';
import { AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';

const areaData = [
  { name: 'Янв', value: 100 },
  { name: 'Фев', value: 250 },
  { name: 'Мар', value: 400 },
  { name: 'Апр', value: 850 },
  { name: 'Май', value: 1200 },
];

const radarData = [
  { subject: 'IT', A: 120, fullMark: 150 },
  { subject: 'Лидерство', A: 98, fullMark: 150 },
  { subject: 'Дизайн', A: 86, fullMark: 150 },
  { subject: 'Медиа', A: 99, fullMark: 150 },
  { subject: 'Спорт', A: 85, fullMark: 150 },
  { subject: 'Волонтерство', A: 65, fullMark: 150 },
];

export default function Home() {
  return (
    <main className="max-w-7xl mx-auto space-y-24 pb-20 overflow-x-hidden">
      
      {/* Hero Section */}
      <section className="grid lg:grid-cols-2 gap-12 items-center min-h-[70vh] relative pt-12">
        <motion.div 
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100 }}
          className="space-y-8 z-10"
        >
          <div className="inline-block px-4 py-2 bg-yellow-400 text-black text-sm lg:text-base font-black uppercase border-4 border-black shadow-[4px_4px_0_0_#000] -rotate-2">
            Кадровый резерв нового поколения
          </div>
          <h1 className="text-6xl sm:text-8xl font-black leading-none tracking-tighter uppercase mb-6 text-black" style={{textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 4px 4px 0 rgba(0,0,0,0.1)'}}>
            Платформа <br />
            <span className="bg-white px-2 border-4 border-black text-pink-500 shadow-[6px_6px_0_0_#000] inline-block my-2">рейтинга</span> <br />
            активности
          </h1>
          <p className="text-xl sm:text-2xl font-bold max-w-lg border-l-8 border-black pl-4 bg-white/50 backdrop-blur-sm py-2">
            Превращаем скучный учёт мероприятий в геймифицированную систему развития талантов с ИИ-аналитикой.
          </p>
          <div className="flex flex-wrap gap-6 pt-4">
            <Link href="/login" className="flex items-center justify-center px-12 py-5 bg-black text-white text-2xl font-black uppercase border-4 border-black hover:bg-yellow-400 hover:text-black hover:-translate-y-2 hover:shadow-[8px_8px_0_0_#000] transition-all">
               СТАРТ →
            </Link>
            <Link href="#roles" className="flex items-center justify-center px-12 py-5 bg-white text-black text-2xl font-black uppercase border-4 border-black hover:bg-cyan-400 hover:-translate-y-2 hover:shadow-[8px_8px_0_0_#000] transition-all">
               РОЛИ
            </Link>
          </div>
        </motion.div>

        <div className="relative h-[500px] hidden lg:block">
           {/* Floating elements inside hero right side */}
           <motion.div 
             animate={{ y: [-10, 10, -10] }} 
             transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
             className="absolute top-10 right-10 bg-white border-4 border-black p-6 w-72 shadow-[8px_8px_0_0_#000] z-20"
           >
              <h3 className="font-black uppercase flex items-center gap-2 mb-4"><TrendingUp className="text-pink-500" strokeWidth={3} /> Динамика роста</h3>
              <div className="h-32">
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={areaData}>
                     <Area type="monotone" dataKey="value" stroke="#000" strokeWidth={4} fill="#f472b6" fillOpacity={1} />
                   </AreaChart>
                 </ResponsiveContainer>
              </div>
           </motion.div>

           <motion.div 
             animate={{ y: [10, -10, 10] }} 
             transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
             className="absolute bottom-10 left-0 bg-cyan-300 border-4 border-black p-6 w-80 shadow-[12px_12px_0_0_#000] z-30 flex gap-4 items-center"
           >
             <div className="bg-black text-white p-3 border-2 border-black rotate-3 hover:rotate-0 transition-all"><Trophy size={32} /></div>
             <div>
               <div className="text-sm font-black uppercase tracking-tight">Текущий Лидер</div>
               <div className="text-2xl font-black italic break-words leading-tight">Алексей С. <br/> 1200 ПТС</div>
             </div>
           </motion.div>

           <motion.div 
             animate={{ scale: [1, 1.05, 1], rotate: [0, 5, 0] }} 
             transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
             className="absolute top-1/2 left-20 bg-yellow-400 border-4 border-black p-4 w-40 shadow-[8px_8px_0_0_#000] z-10 flex flex-col items-center justify-center text-center -translate-y-1/2"
           >
             <Star size={40} className="mb-2 fill-white text-black stroke-[3px]" />
             <div className="font-black uppercase text-sm leading-tight">Новое <br /> Событие!</div>
           </motion.div>
        </div>
      </section>

      {/* Roles Section */}
      <section id="roles" className="space-y-12 relative pt-20 border-t-8 border-black">
        <h2 className="text-5xl sm:text-7xl font-black uppercase italic text-center drop-shadow-[4px_4px_0_#000] text-white tracking-tighter" style={{WebkitTextStroke: '2px black', textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>Три Роли — Одна Цель</h2>
        <div className="grid lg:grid-cols-3 gap-8">
          
          <motion.div whileHover={{ y: -10 }} className="bg-yellow-400 border-4 border-black p-8 shadow-[10px_10px_0_0_#000] flex flex-col items-start gap-4 cursor-crosshair transition-all hover:bg-white relative overflow-hidden group">
             <div className="p-4 bg-black text-white absolute -right-4 -top-4 rounded-full w-24 h-24 flex items-end justify-start pl-5 pb-5 z-0 group-hover:scale-150 transition-transform opacity-30">
               <Crosshair size={48} />
             </div>
             <div className="p-4 bg-black text-white border-4 border-black z-10"><Crosshair size={40} /></div>
             <h3 className="text-4xl font-black uppercase z-10 mt-2">Участник</h3>
             <div className="bg-white border-2 border-black font-black uppercase text-xs px-2 py-1 z-10 -mt-2">Студент / Молодежь</div>
             <p className="font-bold text-lg z-10 leading-snug">Регистрируется на события, прокачивает скиллы через задания и копит баллы рейтинга. Становится видимым для работодателей.</p>
             <ul className="space-y-3 mt-4 font-bold col-span-2 w-full z-10 bg-white p-4 border-4 border-black">
               <li className="flex gap-2 items-center uppercase"><Star size={20} className="text-yellow-500 fill-yellow-500 shrink-0" /> Формирует портфолио</li>
               <li className="flex gap-2 items-center uppercase"><Star size={20} className="text-yellow-500 fill-yellow-500 shrink-0" /> Продвигается в Топ-100</li>
               <li className="flex gap-2 items-center uppercase"><Star size={20} className="text-yellow-500 fill-yellow-500 shrink-0" /> Попадает в кадровый резерв</li>
             </ul>
          </motion.div>

          <motion.div whileHover={{ y: -10 }} className="bg-pink-400 border-4 border-black p-8 shadow-[10px_10px_0_0_#000] flex flex-col items-start gap-4 cursor-crosshair transition-all hover:bg-white relative overflow-hidden group">
             <div className="p-4 bg-black text-white absolute -right-4 -top-4 rounded-full w-24 h-24 flex items-end justify-start pl-5 pb-5 z-0 group-hover:scale-150 transition-transform opacity-30">
               <Zap size={48} />
             </div>
             <div className="p-4 bg-black text-white border-4 border-black z-10"><Zap size={40} /></div>
             <h3 className="text-4xl font-black uppercase z-10 mt-2">Организатор</h3>
             <div className="bg-white border-2 border-black font-black uppercase text-xs px-2 py-1 z-10 -mt-2">ВУЗ / НКО</div>
             <p className="font-bold text-lg z-10 leading-snug">Создаёт мероприятия, распределяет призы и рейтинговые баллы участникам. Соревнуется за доверие аудитории.</p>
             <ul className="space-y-3 mt-4 font-bold col-span-2 w-full z-10 bg-white p-4 border-4 border-black">
               <li className="flex gap-2 items-center uppercase"><Star size={20} className="text-pink-500 fill-pink-500 shrink-0" /> Верифицирует явку</li>
               <li className="flex gap-2 items-center uppercase"><Star size={20} className="text-pink-500 fill-pink-500 shrink-0" /> Раздает баллы/гранты</li>
               <li className="flex gap-2 items-center uppercase"><Star size={20} className="text-pink-500 fill-pink-500 shrink-0" /> Растит рейтинг доверия</li>
             </ul>
          </motion.div>

          <motion.div whileHover={{ y: -10 }} className="bg-cyan-400 border-4 border-black p-8 shadow-[10px_10px_0_0_#000] flex flex-col items-start gap-4 cursor-crosshair transition-all hover:bg-white relative overflow-hidden group">
             <div className="p-4 bg-black text-white absolute -right-4 -top-4 rounded-full w-24 h-24 flex items-end justify-start pl-5 pb-5 z-0 group-hover:scale-150 transition-transform opacity-30">
               <Users size={48} />
             </div>
             <div className="p-4 bg-black text-white border-4 border-black z-10"><Users size={40} /></div>
             <h3 className="text-4xl font-black uppercase z-10 mt-2 break-words">Наблюдатель</h3>
             <div className="bg-white border-2 border-black font-black uppercase text-xs px-2 py-1 z-10 -mt-2">Кадры / Руководство</div>
             <p className="font-bold text-lg z-10 leading-snug">Использует инспектор кадрового резерва для поиска талантов с помощью мощных ИИ-фильтров и детальной аналитики.</p>
             <ul className="space-y-3 mt-4 font-bold col-span-2 w-full z-10 bg-white p-4 border-4 border-black">
               <li className="flex gap-2 items-center uppercase"><Star size={20} className="text-cyan-500 fill-cyan-500 shrink-0" /> Громкая аналитика</li>
               <li className="flex gap-2 items-center uppercase"><Star size={20} className="text-cyan-500 fill-cyan-500 shrink-0" /> Экспорт PDF-отчетов</li>
               <li className="flex gap-2 items-center uppercase"><Star size={20} className="text-cyan-500 fill-cyan-500 shrink-0" /> Хард-хантинг Топов</li>
             </ul>
          </motion.div>

        </div>
      </section>

      {/* AI & Analytics Section */}
      <section className="bg-black text-white border-8 border-black shadow-[16px_16px_0_0_#f472b6] p-8 lg:p-16 relative overflow-visible mt-24 group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400 rounded-full blur-[100px] opacity-20 group-hover:opacity-40 transition-opacity" />
        <div className="grid lg:grid-cols-2 gap-16 items-center relative z-10">
          <div className="space-y-8">
            <h2 className="text-5xl sm:text-6xl font-black uppercase italic leading-none drop-shadow-[2px_2px_0_#22d3ee]">
              <Brain className="inline mr-4 mb-2 text-cyan-400 fill-cyan-400/20" size={64} /> <br />
              Мощь ИИ и Экспорт Аналитики
            </h2>
            <p className="text-xl font-bold opacity-100 max-w-md bg-zinc-900 border-l-8 border-yellow-400 p-4">
              Никакого ручного сбора данных. Платформа <span className="text-yellow-400">автоматически</span> строит матрицы компетенций и генерирует текстовые справки на каждого участника.
            </p>
            <div className="flex flex-col gap-6">
               <div className="bg-black border-4 border-cyan-400 p-6 font-mono text-sm sm:text-lg text-green-400 shadow-[8px_8px_0_0_#22d3ee]">
                  <span className="animate-pulse shadow-green-500/50 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]">_</span> Генерация отчета: Кандидат обладает выдающимся лидерским потенциалом. Замечен на 12 мероприятиях блока "Менеджмент".
               </div>
               <motion.button 
                 whileHover={{ scale: 1.05 }}
                 whileTap={{ scale: 0.95 }}
                 className="self-start flex items-center gap-4 bg-white text-black font-black uppercase text-xl px-10 py-5 border-4 border-black hover:bg-yellow-400 transition-colors shadow-[6px_6px_0_0_#f472b6] hover:shadow-[10px_10px_0_0_#FFF]"
               >
                 <Download size={28} strokeWidth={3} /> СКАЧАТЬ PDF ПАСПОРТ
               </motion.button>
            </div>
          </div>

          <div className="bg-white border-8 border-black p-6 shadow-[-16px_16px_0_0_#eab308] flex flex-col items-center rotate-2 transform hover:rotate-0 transition-transform duration-500">
             <h4 className="text-black font-black uppercase text-3xl border-b-8 border-black pb-4 mb-6 w-full text-center tracking-tighter">Матрица компетенций</h4>
             <div className="w-full h-[350px]">
               <ResponsiveContainer width="100%" height="100%">
                 <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                   <PolarGrid stroke="#000" strokeWidth={3} />
                   <PolarAngleAxis dataKey="subject" tick={{ fill: '#000', fontWeight: 'black', fontSize: 16, fontFamily: 'inherit' }} />
                   <Radar name="Навыки" dataKey="A" stroke="#000" strokeWidth={5} fill="#22d3ee" fillOpacity={0.8} />
                 </RadarChart>
               </ResponsiveContainer>
             </div>
             <div className="mt-6 bg-black text-white w-full text-center py-3 font-black uppercase text-xl border-4 border-transparent hover:border-cyan-400 transition-colors cursor-default">
                AI Scanning... 100%
             </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="text-center space-y-10 py-16 border-t-8 border-b-8 border-black mt-32 bg-yellow-400 mb-10 shadow-[0_10px_0_0_#000]">
        <h2 className="text-6xl sm:text-8xl font-black uppercase tracking-tighter italic" style={{WebkitTextStroke: '2px black', color: 'white', textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'}}>Готов начать?</h2>
        <p className="font-bold text-3xl max-w-2xl mx-auto bg-black text-white px-4 py-2 border-4 border-white transform -rotate-1 shadow-[6px_6px_0_0_rgba(255,255,255,0.5)]">Строй карьеру, развивай навыки, соревнуйся за место в Топ-100!</p>
        <div className="pt-8">
          <Link href="/login" className="inline-block px-16 py-8 bg-pink-500 text-white text-4xl font-black uppercase border-8 border-black hover:bg-black hover:text-pink-500 hover:-translate-y-2 hover:shadow-[16px_16px_0_0_#22d3ee] transition-all cursor-crosshair">
            ВОЙТИ НА ПЛАТФОРМУ
          </Link>
        </div>
      </section>

    </main>
  );
}
