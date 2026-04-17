import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Building2, 
  ShieldAlert, 
  ShieldCheck, 
  BarChart3, 
  Settings2, 
  Lock, 
  Unlock,
  Package,
  UserPlus,
  Search,
  ChevronRight,
  AlertCircle,
  X,
  Target,
  Factory,
  MapPin,
  Tag
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  getDocs, 
  getDoc,
  query, 
  where 
} from 'firebase/firestore';
import { cn } from '../../lib/utils';

interface Company {
  id: string;
  name: string;
  type: string;
  city: string;
  ownerUid: string;
  isBlocked?: boolean;
  employeeLimit?: number;
  productLimit?: number;
  employeeCount?: number;
  projectCount?: number;
  address?: string;
  photos?: string[];
  tariffExpiration?: string;
  manufacturerId?: string;
}

interface User {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  companyId: string;
  isBlocked?: boolean;
}

const CompanyDateInput = ({ company, updateLimit }: { company: Company, updateLimit: any }) => {
  const [localDate, setLocalDate] = useState(company.tariffExpiration ? new Date(company.tariffExpiration).toISOString().split('T')[0] : '');

  useEffect(() => {
    setLocalDate(company.tariffExpiration ? new Date(company.tariffExpiration).toISOString().split('T')[0] : '');
  }, [company.tariffExpiration]);

  const handleBlur = () => {
    if (localDate) {
      const date = new Date(localDate);
      if (!isNaN(date.getTime())) {
        updateLimit(company.id, 'tariffExpiration', date.toISOString());
      }
    } else {
      // Optional: handle clearing the date if needed
    }
  };

  return (
    <input 
      type="date"
      value={localDate}
      onChange={(e) => setLocalDate(e.target.value)}
      onBlur={handleBlur}
      className="bg-transparent font-bold text-gray-900 outline-none text-sm min-w-[120px]"
    />
  );
};

export const AppAdminView = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'companies' | 'stats' | 'requests'>('companies');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCoefficients, setSelectedCoefficients] = useState<any>(null);
  const [coeffModalOpen, setCoeffModalOpen] = useState(false);
  const [coeffLoading, setCoeffLoading] = useState(false);

  const fetchCoefficients = async (salon: Company) => {
    if (!salon.manufacturerId) return;
    setCoeffLoading(true);
    setCoeffModalOpen(true);
    try {
      const prodDoc = await getDoc(doc(db, 'companies', salon.manufacturerId, 'settings', 'production'));
      if (prodDoc.exists()) {
        const data = prodDoc.data();
        const isSpecial = data.specialConditionIds?.includes(salon.id);
        const coeffs = isSpecial && data.salonCoefficients?.[salon.id] 
          ? data.salonCoefficients[salon.id] 
          : data.standardCoefficients;
        
        const manufacturer = companies.find(c => c.id === salon.manufacturerId);
        setSelectedCoefficients({
          coeffs,
          salonName: salon.name,
          manufacturerName: manufacturer?.name || 'Производство',
          isSpecial
        });
      } else {
        setSelectedCoefficients({
          coeffs: null,
          salonName: salon.name,
          manufacturerName: 'Не настроено'
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setCoeffLoading(false);
    }
  };

  useEffect(() => {
    const unsubCompanies = onSnapshot(collection(db, 'companies'), async (snapshot) => {
      const companyList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
      
      // Fetch stats and production details for each company
      const updatedCompanies = await Promise.all(companyList.map(async (company) => {
        const employeesSnapshot = await getDocs(collection(db, 'companies', company.id, 'employees'));
        
        // Count projects
        const qProjects = collection(db, 'companies', company.id, 'projects');
        const projectsSnapshot = await getDocs(qProjects);

        // Fetch production settings if applicable
        let address = '';
        let photos: string[] = [];
        try {
          const settingsSnap = await getDoc(doc(db, 'companies', company.id, 'settings', 'production'));
          if (settingsSnap.exists()) {
            const sData = settingsSnap.data();
            address = sData.address || '';
            photos = sData.photos || [];
          }
        } catch (e) {
          console.error(`Error fetching settings for ${company.id}`, e);
        }

        return { 
          ...company, 
          employeeCount: employeesSnapshot.size,
          projectCount: projectsSnapshot.size,
          address,
          photos
        };
      }));
      
      setCompanies(updatedCompanies);
      setLoading(false);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const userList = snapshot.docs.map(doc => doc.data() as User);
      setUsers(userList);
    });

    const unsubRequests = onSnapshot(collection(db, 'tariffRequests'), (snapshot) => {
      const reqList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setRequests(reqList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });

    return () => {
      unsubCompanies();
      unsubUsers();
      unsubRequests();
    };
  }, []);

  const toggleCompanyBlock = async (companyId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'companies', companyId), {
        isBlocked: !currentStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `companies/${companyId}`);
    }
  };

  const toggleUserBlock = async (uid: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        isBlocked: !currentStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const updateLimit = async (companyId: string, field: 'employeeLimit' | 'productLimit' | 'tariffExpiration', value: any) => {
    try {
      await updateDoc(doc(db, 'companies', companyId), {
        [field]: value
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `companies/${companyId}`);
    }
  };

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    totalCompanies: companies.length,
    totalUsers: users.length,
    blockedCompanies: companies.filter(c => c.isBlocked).length,
    productionCount: companies.filter(c => c.type === 'Мебельное производство').length,
    salonCount: companies.filter(c => c.type === 'Салон').length,
    designerCount: companies.filter(c => c.type === 'Дизайнер').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Панель администратора</h1>
            <p className="text-gray-500">Управление компаниями и пользователями системы</p>
          </div>
          
          <div className="flex bg-white p-1 rounded-2xl border border-gray-200 shadow-sm">
            <button 
              onClick={() => setActiveTab('companies')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'companies' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Building2 className="w-4 h-4" />
              Компании
            </button>
            <button 
              onClick={() => setActiveTab('stats')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                activeTab === 'stats' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <BarChart3 className="w-4 h-4" />
              Статистика
            </button>
            <button 
              onClick={() => setActiveTab('requests')}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 relative",
                activeTab === 'requests' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <AlertCircle className="w-4 h-4" />
              Заявки
              {requests.filter(r => r.status === 'pending').length > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>
          </div>
        </div>

        {activeTab === 'stats' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard icon={<Building2 />} label="Всего компаний" value={stats.totalCompanies} color="blue" />
            <StatCard icon={<Users />} label="Всего пользователей" value={stats.totalUsers} color="indigo" />
            <StatCard icon={<ShieldAlert />} label="Заблокировано" value={stats.blockedCompanies} color="red" />
            <StatCard icon={<Factory />} label="Производств" value={stats.productionCount} color="green" />
            
            <div className="lg:col-span-4 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Распределение по типам</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                <DistributionItem label="Производства" count={stats.productionCount} total={stats.totalCompanies} color="bg-blue-500" />
                <DistributionItem label="Салоны" count={stats.salonCount} total={stats.totalCompanies} color="bg-indigo-500" />
                <DistributionItem label="Дизайнеры" count={stats.designerCount} total={stats.totalCompanies} color="bg-purple-500" />
              </div>
            </div>
          </div>
        ) : activeTab === 'requests' ? (
          <div className="space-y-6">
            {requests.map(req => (
              <div key={req.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{req.companyName}</h3>
                    <p className="text-sm text-gray-500">{new Date(req.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold",
                    req.status === 'pending' ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"
                  )}>
                    {req.status === 'pending' ? 'Ожидает' : 'Обработано'}
                  </span>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                  <p><span className="font-medium">Тариф:</span> {req.request.type}</p>
                  <p><span className="font-medium">Период:</span> {req.request.period === 'year' ? '1 год' : '1 месяц'}</p>
                  {req.request.extraEmployees > 0 && <p><span className="font-medium">Доп. сотрудники:</span> {req.request.extraEmployees}</p>}
                  {req.request.extraSalons > 0 && <p><span className="font-medium">Доп. салоны:</span> {req.request.extraSalons}</p>}
                  {req.request.extraDesigners > 0 && <p><span className="font-medium">Доп. дизайнеры:</span> {req.request.extraDesigners}</p>}
                  {req.request.extraCities > 0 && <p><span className="font-medium">Доп. города:</span> {req.request.extraCities}</p>}
                </div>
                {req.status === 'pending' && (
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={async () => {
                        try {
                          await updateDoc(doc(db, 'tariffRequests', req.id), { status: 'completed' });
                        } catch (error) {
                          console.error(error);
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
                    >
                      Отметить как обработанное
                    </button>
                  </div>
                )}
              </div>
            ))}
            {requests.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Нет заявок на тарифы
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text"
                placeholder="Поиск компании..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
              />
            </div>

            <div className="grid gap-6">
              {filteredCompanies.map(company => (
                <div key={company.id} className={cn(
                  "bg-white p-6 rounded-[2rem] border transition-all shadow-sm hover:shadow-md",
                  company.isBlocked ? "border-red-100 bg-red-50/30" : "border-gray-100"
                )}>
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0",
                        company.isBlocked ? "bg-red-100 text-red-600" : "bg-blue-50 text-blue-600"
                      )}>
                        <Building2 className="w-8 h-8" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-xl font-bold text-gray-900">{company.name}</h3>
                          {company.isBlocked && (
                            <span className="px-3 py-1 bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Заблокирована
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {company.city}</span>
                          <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> {company.type}</span>
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {company.employeeCount || 0} сотрудников</span>
                          <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3 text-blue-500" /> {company.projectCount || 0} расчетов</span>
                          {company.manufacturerId && (
                            <div className="flex items-center gap-2 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold">
                              <Factory className="w-3 h-3" />
                              Производство: {companies.find(c => c.id === company.manufacturerId)?.name || '...'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      {(company.type === 'Салон' || company.type === 'Дизайнер') && company.manufacturerId && (
                        <button 
                          onClick={() => fetchCoefficients(company)}
                          className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl font-bold text-xs transition-all flex items-center gap-2"
                        >
                          <BarChart3 className="w-4 h-4" />
                          Коэффициенты
                        </button>
                      )}
                      <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                        <div className="px-3">
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Лимит сотр.</label>
                          <input 
                            type="number"
                            value={company.employeeLimit || 5}
                            onChange={(e) => updateLimit(company.id, 'employeeLimit', parseInt(e.target.value))}
                            className="w-16 bg-transparent font-bold text-gray-900 outline-none"
                          />
                        </div>
                        <div className="w-px h-8 bg-gray-200"></div>
                        <div className="px-3">
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Лимит тов.</label>
                          <input 
                            type="number"
                            value={company.productLimit || 100}
                            onChange={(e) => updateLimit(company.id, 'productLimit', parseInt(e.target.value))}
                            className="w-16 bg-transparent font-bold text-gray-900 outline-none"
                          />
                        </div>
                        <div className="w-px h-8 bg-gray-200"></div>
                        <div className="px-3">
                          <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Тариф до</label>
                          <CompanyDateInput company={company} updateLimit={updateLimit} />
                        </div>
                      </div>

                      <button 
                        onClick={() => toggleCompanyBlock(company.id, !!company.isBlocked)}
                        className={cn(
                          "px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2",
                          company.isBlocked 
                            ? "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200" 
                            : "bg-red-50 text-red-600 hover:bg-red-100"
                        )}
                      >
                        {company.isBlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                        {company.isBlocked ? "Разблокировать" : "Заблокировать"}
                      </button>
                    </div>
                  </div>

                  {/* Production Details */}
                  {(company.address || (company.photos && company.photos.length > 0)) && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col md:flex-row gap-6">
                      {company.photos && company.photos.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 shrink-0 md:max-w-[300px]">
                          {company.photos.slice(0, 5).map((photo, i) => (
                            <img key={i} src={photo} alt="" className="w-16 h-16 rounded-lg object-cover border border-white shadow-sm" referrerPolicy="no-referrer" />
                          ))}
                        </div>
                      )}
                      <div>
                        {company.address && (
                          <div className="flex items-start gap-2 text-xs text-gray-600">
                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                            <span>{company.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Employee List for this company */}
                  <div className="mt-8 pt-8 border-t border-gray-100">
                    <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Сотрудники компании</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {users.filter(u => u.companyId === company.id).map(user => (
                        <div key={user.uid} className={cn(
                          "p-4 rounded-2xl border flex items-center justify-between group transition-all",
                          user.isBlocked ? "bg-red-50 border-red-100" : "bg-white border-gray-100 hover:border-blue-200"
                        )}>
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold",
                              user.isBlocked ? "bg-red-100 text-red-600" : (user.uid === company.ownerUid ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500")
                            )}>
                              {user.displayName?.charAt(0) || 'U'}
                            </div>
                            <div className="overflow-hidden">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-gray-900 truncate">{user.displayName}</p>
                                {user.uid === company.ownerUid && (
                                  <span className="bg-blue-50 text-blue-600 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-blue-100">Админ</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => toggleUserBlock(user.uid, !!user.isBlocked)}
                            className={cn(
                              "p-2 rounded-xl transition-all",
                              user.isBlocked ? "text-green-600 hover:bg-green-100" : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                            )}
                            title={user.isBlocked ? "Разблокировать" : "Заблокировать"}
                          >
                            {user.isBlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Coefficients Modal */}
      {coeffModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-2xl font-black text-gray-900 leading-none mb-2">Коэффициенты</h3>
                <p className="text-sm text-gray-500 font-medium">
                  Для <span className="text-indigo-600 font-bold">{selectedCoefficients?.salonName}</span> от <span className="text-blue-600 font-bold">{selectedCoefficients?.manufacturerName}</span>
                </p>
              </div>
              <button 
                onClick={() => setCoeffModalOpen(false)}
                className="p-3 hover:bg-white rounded-2xl transition-all text-gray-400 hover:text-gray-900 shadow-sm hover:shadow"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8">
              {coeffLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm font-bold text-gray-400 animate-pulse uppercase tracking-widest">Загрузка данных...</p>
                </div>
              ) : selectedCoefficients?.coeffs ? (
                <div className="space-y-6">
                  {selectedCoefficients.isSpecial && (
                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3">
                      <ShieldCheck className="w-6 h-6 text-indigo-600" />
                      <p className="text-sm font-bold text-indigo-900">Активны специальные условия для этого клиента</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'ldsp', label: 'ЛДСП' },
                      { key: 'hdf', label: 'ХДФ' },
                      { key: 'edge', label: 'Кромка' },
                      { key: 'facadeSheet', label: 'Фасад (плита)' },
                      { key: 'facadeCustom', label: 'Фасад (заказной)' },
                      { key: 'hardware', label: 'Фурнитура' },
                      { key: 'assembly', label: 'Сборка' },
                      { key: 'delivery', label: 'Доставка' },
                    ].map(({ key, label }) => {
                      const val = selectedCoefficients.coeffs?.[key];
                      return (
                        <div key={key} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                          <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">{label}</span>
                          <span className="text-xl font-black text-gray-900">x{val !== undefined ? val : 1}</span>
                        </div>
                      );
                    })}
                    {Object.entries(selectedCoefficients.coeffs || {}).filter(([k]) => ![
                      'ldsp', 'hdf', 'edge', 'facadeSheet', 'facadeCustom', 'hardware', 'assembly', 'delivery'
                    ].includes(k)).map(([key, value]) => (
                      <div key={key} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                          {key.startsWith('cat_') ? key.replace('cat_', '') : key}
                        </span>
                        <span className="text-xl font-black text-gray-900">x{value as number}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center">
                  <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-lg font-bold text-gray-400">Коэффициенты не найдены</p>
                  <p className="text-sm text-gray-500">Производство еще не настроило параметры для этого клиента.</p>
                </div>
              )}
            </div>
            
            <div className="p-8 bg-gray-50 border-t border-gray-100">
              <button 
                onClick={() => setCoeffModalOpen(false)}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-lg shadow-gray-200"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value, color }: { icon: React.ReactElement, label: string, value: number, color: string }) => {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 shadow-blue-100",
    indigo: "bg-indigo-50 text-indigo-600 shadow-indigo-100",
    red: "bg-red-50 text-red-600 shadow-red-100",
    green: "bg-green-50 text-green-600 shadow-green-100",
  };

  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center gap-4">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0", colors[color])}>
        {React.cloneElement(icon as any, { className: "w-8 h-8" })}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-2xl font-black text-gray-900">{value}</p>
      </div>
    </div>
  );
};

const DistributionItem = ({ label, count, total, color }: { label: string, count: number, total: number, color: string }) => {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-bold">
        <span className="text-gray-700">{label}</span>
        <span className="text-gray-900">{count}</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-1000", color)} 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};



