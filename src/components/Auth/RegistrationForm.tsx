import React, { useState, useRef, useEffect } from 'react';
import { Building2, User, Mail, Lock, MapPin, Briefcase, ArrowRight, CheckCircle2, Check, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { RUSSIAN_CITIES } from '../../lib/cities';

type CompanyType = 'Мебельное производство' | 'Салон' | 'Дизайнер';
type WorkFormat = 
  | 'Производим для своей розницы'
  | 'Производим оптовикам'
  | 'Только продажи'
  | 'Продажи и заказы';

export interface RegistrationData {
  companyName: string;
  companyType: CompanyType | '';
  city: string;
  workFormat: WorkFormat[];
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

const WORK_FORMATS = {
  'Мебельное производство': [
    { id: 'Производим для своей розницы', label: 'Производим для своей розницы', description: '' },
    { id: 'Производим оптовикам', label: 'Производим оптовикам', description: '' }
  ],
  'Салон': [
    { id: 'Только продажи', label: 'Только продажи', description: 'Вы продаете мебель для своих розничных клиентов, производите не у мебельных компаний зарегистрированных в сервисе' },
    { id: 'Продажи и заказы', label: 'Продажи и заказы', description: 'Вы продаете мебель для своих розничных клиентов и планируете заказывать у мебельных компаний зарегистрированных в сервисе' }
  ],
  'Дизайнер': [
    { id: 'Только продажи', label: 'Только продажи', description: 'Вы продаете мебель для своих клиентов, производите не у мебельных компаний зарегистрированных в сервисе' },
    { id: 'Продажи и заказы', label: 'Продажи и заказы', description: 'Вы продаете мебель для своих клиентов и планируете заказывать производство у мебельных компаний зарегистрированных в сервисе' }
  ]
};

export const RegistrationForm = ({ 
  onRegister,
  onGoToLogin
}: { 
  onRegister: (data: RegistrationData) => Promise<void>;
  onGoToLogin: () => void;
}) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RegistrationData>({
    companyName: '',
    companyType: '',
    city: '',
    workFormat: [],
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });

  const [cityQuery, setCityQuery] = useState('');
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setIsCityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCities = RUSSIAN_CITIES.filter(city => 
    city.toLowerCase().includes(cityQuery.toLowerCase())
  );

  const handleNext = () => {
    if (step === 1 && data.companyName && data.companyType) setStep(2);
    else if (step === 2 && data.city && data.workFormat.length > 0) setStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (data.adminName && data.adminEmail && data.adminPassword) {
      setLoading(true);
      try {
        await onRegister(data);
      } catch (error) {
        console.error("Registration error:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleWorkFormat = (format: WorkFormat) => {
    if (data.companyType === 'Мебельное производство') {
      setData(prev => {
        const formats = prev.workFormat.includes(format)
          ? prev.workFormat.filter(f => f !== format)
          : [...prev.workFormat, format];
        return { ...prev, workFormat: formats };
      });
    } else {
      setData(prev => ({ ...prev, workFormat: [format] }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Building2 className="w-6 h-6 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Регистрация компании
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Шаг {step} из 3
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-gray-100">
          
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Название компании</label>
                <input 
                  type="text"
                  value={data.companyName}
                  onChange={(e) => setData(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="Например, МебельГрад"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">Выберите тип компании</label>
                <div className="space-y-3">
                  {(['Мебельное производство', 'Салон', 'Дизайнер'] as CompanyType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setData({ ...data, companyType: type, workFormat: [] })}
                      className={cn(
                        "w-full flex items-center p-4 border rounded-xl text-left transition-all",
                        data.companyType === type 
                          ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50" 
                          : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full border flex items-center justify-center mr-3",
                        data.companyType === type ? "border-blue-500" : "border-gray-300"
                      )}>
                        {data.companyType === type && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                      </div>
                      <span className={cn(
                        "font-medium",
                        data.companyType === type ? "text-blue-900" : "text-gray-900"
                      )}>{type}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleNext}
                disabled={!data.companyType || !data.companyName}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Далее <ArrowRight className="ml-2 w-4 h-4" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div ref={cityDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Город</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={isCityDropdownOpen ? cityQuery : data.city}
                    onChange={(e) => {
                      setCityQuery(e.target.value);
                      setIsCityDropdownOpen(true);
                      if (data.city) setData({ ...data, city: '' });
                    }}
                    onFocus={() => {
                      setCityQuery('');
                      setIsCityDropdownOpen(true);
                    }}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Например, Москва"
                  />
                  {isCityDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-xl py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                      {filteredCities.length === 0 ? (
                        <div className="relative cursor-default select-none py-2 px-4 text-gray-700">
                          Ничего не найдено
                        </div>
                      ) : (
                        filteredCities.map((city) => (
                          <div
                            key={city}
                            className={cn(
                              "relative cursor-pointer select-none py-2 pl-10 pr-4 hover:bg-blue-50",
                              data.city === city ? "bg-blue-100 text-blue-900" : "text-gray-900"
                            )}
                            onClick={() => {
                              setData({ ...data, city });
                              setCityQuery(city);
                              setIsCityDropdownOpen(false);
                            }}
                          >
                            <span className={cn("block truncate", data.city === city ? "font-medium" : "font-normal")}>
                              {city}
                            </span>
                            {data.city === city && (
                              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                                <Check className="h-5 w-5" aria-hidden="true" />
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">Формат работы</label>
                <div className="space-y-3">
                  {data.companyType && WORK_FORMATS[data.companyType].map((format) => {
                    const isSelected = data.workFormat.includes(format.id as WorkFormat);
                    return (
                      <button
                        key={format.id}
                        onClick={() => toggleWorkFormat(format.id as WorkFormat)}
                        className={cn(
                          "w-full flex items-start p-4 border rounded-xl text-left transition-all",
                          isSelected 
                            ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50" 
                            : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                        )}
                      >
                        <div className={cn(
                          "mt-0.5 w-5 h-5 flex-shrink-0 border flex items-center justify-center mr-3",
                          isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300",
                          data.companyType !== 'Мебельное производство' ? "rounded-full" : "rounded"
                        )}>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div>
                          <span className={cn(
                            "font-medium block",
                            isSelected ? "text-blue-900" : "text-gray-900"
                          )}>{format.label}</span>
                          {format.description && (
                            <span className="text-xs text-gray-500 mt-1 block leading-relaxed">
                              {format.description}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Назад
                </button>
                <button
                  onClick={handleNext}
                  disabled={!data.city || data.workFormat.length === 0}
                  className="flex-1 flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Далее <ArrowRight className="ml-2 w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ФИО Администратора</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={data.adminName}
                    onChange={(e) => setData({ ...data, adminName: e.target.value })}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Иванов Иван Иванович"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email (Логин)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={data.adminEmail}
                    onChange={(e) => setData({ ...data, adminEmail: e.target.value })}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="admin@company.ru"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    required
                    value={data.adminPassword}
                    onChange={(e) => setData({ ...data, adminPassword: e.target.value })}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Назад
                </button>
                <button
                  type="submit"
                  disabled={!data.adminName || !data.adminEmail || !data.adminPassword || loading}
                  className="flex-1 flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Завершить <CheckCircle2 className="ml-2 w-4 h-4" /></>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
