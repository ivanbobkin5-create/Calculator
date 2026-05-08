import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Package, 
  Wrench, 
  Truck, 
  ClipboardCheck, 
  Save,
  ImageIcon,
  Plus,
  Upload,
  PenTool
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { SketchAnnotator } from './SketchAnnotator';

interface Project {
  id: string;
  name: string;
  data: any;
  createdAt: string;
  totalPrice?: number;
}

// Simple Russian holiday list for 2024/2025 (representative)
const RU_HOLIDAYS = [
  '01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07', '01-08', // New Year
  '02-23', // Defender of Fatherland
  '03-08', // Women's Day
  '05-01', // Labor Day
  '05-09', // Victory Day
  '06-12', // Russia Day
  '11-04', // Unity Day
];

const calculateReadyDate = (startDate: Date, days: number, cycle: 'working' | 'calendar') => {
  const result = new Date(startDate);
  if (cycle === 'calendar') {
    result.setDate(result.getDate() + days);
    return result;
  }

  let addedDays = 0;
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dateStr = `${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
    const isHoliday = RU_HOLIDAYS.includes(dateStr);

    if (!isWeekend && !isHoliday) {
      addedDays++;
    }
  }
  return result;
};

export const ProjectSetCheckoutModal = ({ 
  projects, 
  onClose, 
  onSave,
  productionCycle = 'working'
}: { 
  projects: Project[]; 
  onClose: () => void; 
  onSave: (data: any) => void;
  productionCycle?: 'working' | 'calendar';
}) => {
  const [contractNumber, setContractNumber] = useState('');
  const [contractDate, setContractDate] = useState(new Date().toISOString().split('T')[0]);
  const [leadTimeDays, setLeadTimeDays] = useState(30);
  const [sketches, setSketches] = useState<string[]>([]);
  const [expandHardware, setExpandHardware] = useState(false);
  const [expandServices, setExpandServices] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result && typeof ev.target.result === 'string') {
          const img = new Image();
          img.onload = () => {
            let width = img.width;
            let height = img.height;
            const maxDim = 800;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height *= maxDim / width;
                width = maxDim;
              } else {
                width *= maxDim / height;
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              setSketches(prev => [...prev, canvas.toDataURL('image/jpeg', 0.6)]);
            } else {
              setSketches(prev => [...prev, ev.target!.result as string]);
            }
          };
          img.src = ev.target.result;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const readyDate = useMemo(() => {
    return calculateReadyDate(new Date(contractDate), leadTimeDays, productionCycle);
  }, [contractDate, leadTimeDays, productionCycle]);

  const summary = useMemo(() => {
    let totalMaterialsPrice = 0;
    let totalHardwarePrice = 0;
    let totalServicesPrice = 0;
    let totalDeliveryPrice = 0;
    let totalAssemblyPrice = 0;

    const materials: any[] = [];
    const hardware: any[] = [];
    const services: any[] = [];

    projects.forEach(p => {
      const results = p.data.results || {};
      Object.values(results).forEach((r: any) => {
        totalMaterialsPrice += (r.totalPrice || 0);
        materials.push({
          projectName: p.name,
          category: r.category,
          brand: r.brand,
          decor: r.decor,
          price: r.totalPrice
        });
      });

      (p.data.addedProducts || []).forEach((item: any) => {
        const qty = item.quantity || item.qty || 1;
        totalHardwarePrice += ((item.price || 0) * qty);
        hardware.push({ ...item, qty, projectName: p.name });
      });

      (p.data.addedServices || []).forEach((item: any) => {
        const qty = item.quantity || item.qty || 1;
        totalServicesPrice += ((item.price || 0) * qty);
        services.push({ ...item, qty, projectName: p.name });
      });

      const serviceData = p.data.serviceData || {};
      totalDeliveryPrice += (serviceData.deliveryPrice || 0);
      totalAssemblyPrice += (serviceData.assemblyPrice || 0);
    });

    return {
      totalMaterialsPrice,
      totalHardwarePrice,
      totalServicesPrice,
      totalDeliveryPrice,
      totalAssemblyPrice,
      totalOverall: totalMaterialsPrice + totalHardwarePrice + totalServicesPrice + totalDeliveryPrice + totalAssemblyPrice,
      materials,
      hardware,
      services
    };
  }, [projects]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-gray-50 w-full max-w-5xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/20">
        {/* Header */}
        <div className="px-8 py-6 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 leading-none">Оформление заказа</h2>
              <p className="text-sm text-gray-400 font-medium mt-1">Итоговая спецификация для {projects.length === 1 ? 'проекта' : 'комплекта из ' + projects.length + ' проектов'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 hover:bg-gray-100 rounded-2xl text-gray-400 hover:text-gray-900 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {isAnnotating ? (
          <div className="flex-1 flex flex-col min-h-0 bg-gray-50 p-6 overflow-hidden relative z-20">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4">Редактор эскиза</h3>
            <div className="flex-1 min-h-[500px] relative bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="absolute inset-0 overflow-auto">
                <SketchAnnotator 
                  imageUrl={""} 
                  onSave={(data) => {
                    setSketches(prev => [...prev, data]);
                    setIsAnnotating(false);
                  }} 
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button 
                onClick={() => setIsAnnotating(false)}
                className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Main Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Договор №</label>
              <input 
                type="text"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold shadow-sm"
                placeholder="11-0326-05"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Дата договора</label>
              <input 
                type="date"
                value={contractDate}
                onChange={(e) => setContractDate(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold shadow-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Срок (дней)</label>
              <div className="flex items-center gap-4">
                <input 
                  type="number"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold shadow-sm"
                />
                <div className="flex flex-col min-w-[80px]">
                  <span className="text-[10px] font-black text-gray-900 leading-none">
                    {productionCycle === 'working' ? 'Раб. дни' : 'Кал. дни'}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5">РФ Праздники</span>
                </div>
              </div>
            </div>
          </div>

          {/* Resulting Date Display */}
          <div className="p-6 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-[2rem] border border-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                <Calendar className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Дата готовности</p>
                <p className="text-2xl font-black text-indigo-900">
                  {readyDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Общая сумма</p>
              <p className="text-3xl font-black text-indigo-900">{summary.totalOverall.toLocaleString()} ₽</p>
            </div>
          </div>

          {/* Breakdown Sections */}
          <div className="space-y-6">
            {/* Projects in Set */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-500" /> Состав заказа
              </h3>
              <div className="space-y-3">
                {projects.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <span className="font-black text-gray-800">{p.name}</span>
                    <span className="text-sm font-bold text-blue-600">
                      {(p.totalPrice || 0).toLocaleString()} ₽
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hardware List (Expandable) */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
               <button 
                  onClick={() => setExpandHardware(!expandHardware)}
                  className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
               >
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                    <Save className="w-4 h-4 text-orange-500" /> Фурнитура и товары
                  </h3>
                  {expandHardware ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
               </button>
               {expandHardware && (
                 <div className="px-6 pb-6 space-y-2 border-t border-gray-50 pt-4">
                   {summary.hardware.map((item, idx) => (
                     <div key={idx} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800">{item.name}</span>
                          <span className="text-[10px] text-gray-400">Проект: {item.projectName}</span>
                        </div>
                        <div className="flex items-center gap-4 min-w-[120px] justify-end">
                           <span className="text-gray-500 font-medium">{item.qty} {item.unit || 'шт'}</span>
                           <span className="font-black text-gray-900">{((item.price || 0) * item.qty).toLocaleString()} ₽</span>
                        </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>

            {/* Services List (Expandable) */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
               <button 
                  onClick={() => setExpandServices(!expandServices)}
                  className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
               >
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-green-500" /> Услуги и работы
                  </h3>
                  {expandServices ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
               </button>
               {expandServices && (
                 <div className="px-6 pb-6 space-y-2 border-t border-gray-50 pt-4">
                   {summary.services.map((item, idx) => (
                     <div key={idx} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800">{item.name}</span>
                          <span className="text-[10px] text-gray-400">Проект: {item.projectName}</span>
                        </div>
                        <div className="flex items-center gap-4 min-w-[120px] justify-end">
                           <span className="text-gray-500 font-medium">{item.qty} {item.unit}</span>
                           <span className="font-black text-gray-900">{((item.price || 0) * item.qty).toLocaleString()} ₽</span>
                        </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>

            {/* Delivery & Assembly Separate */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-bold text-gray-700">Всего за доставку</span>
                </div>
                <span className="font-black text-gray-900">{summary.totalDeliveryPrice.toLocaleString()} ₽</span>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Wrench className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-bold text-gray-700">Всего за сборку</span>
                </div>
                <span className="font-black text-gray-900">{summary.totalAssemblyPrice.toLocaleString()} ₽</span>
              </div>
            </div>
          </div>

          {/* Sketches / Images */}
          <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
             <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-500" /> Эскизы и визуализации
             </h3>
             <div className="flex flex-wrap gap-4">
                {sketches.map((url, idx) => (
                  <div key={idx} className="relative group w-32 h-32 rounded-2xl overflow-hidden border border-gray-100 shadow-sm transition-all hover:shadow-md">
                    <img src={url} alt={`Sketch ${idx + 1}`} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => setSketches(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                      title="Удалить эскиз"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-indigo-400 hover:text-indigo-400 transition-all group hover:bg-indigo-50/30"
                >
                  <Upload className="w-6 h-6 group-hover:-translate-y-1 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-center px-2">Загрузить с ПК</span>
                </button>
                
                <button 
                  onClick={() => setIsAnnotating(true)}
                  className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-indigo-400 hover:text-indigo-400 transition-all group hover:bg-indigo-50/30"
                >
                  <PenTool className="w-6 h-6 group-hover:-translate-y-1 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-center px-2">Рисовать эскиз</span>
                </button>
             </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-white border-t border-gray-100 flex items-center justify-end gap-4 sticky bottom-0 z-10">
          <button 
            onClick={onClose}
            className="px-8 py-3 rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all border border-gray-200"
          >
            Отмена
          </button>
          <button 
            onClick={() => {
              onSave({
                contractNumber,
                contractDate,
                leadTimeDays,
                readyDate: readyDate.toISOString(),
                productionCycle,
                projectIds: projects.map(p => p.id),
                sketches,
                totalPrice: summary.totalOverall,
                summary
              });
            }}
            className="px-10 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
          >
            <ClipboardCheck className="w-5 h-5" />
            Создать спецификацию
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
};
