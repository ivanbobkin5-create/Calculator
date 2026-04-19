import React, { useState, useMemo, useEffect } from 'react';
import * as ReactDOM from 'react-dom';
import { formatPhoneNumber } from './lib/utils';

// @ts-ignore
if (!(ReactDOM as any).findDOMNode) {
  // @ts-ignore
  (ReactDOM as any).findDOMNode = (component: any) => component;
}

import Papa from 'papaparse';
import { RegistrationForm, RegistrationData } from './components/Auth/RegistrationForm';
import { LoginForm } from './components/Auth/LoginForm';
import { AdminSettingsView } from './components/Admin/AdminSettingsView';
import { AppAdminView } from './components/Admin/AppAdminView';
import { LandingPage } from './components/Landing/LandingPage';
import { ProjectsView } from './components/Projects/ProjectsView';
import { ProjectSpecificationView } from './components/Projects/ProjectSpecificationView';
import { 
  Menu, 
  X, 
  Calculator, 
  Tag, 
  Search, 
  ChevronRight, 
  ChevronDown,
  Settings,
  LayoutDashboard,
  Database,
  ShoppingBag,
  Package,
  Plus,
  Wrench,
  Truck,
  MapPin,
  CheckCircle2,
  Trash2,
  Edit2,
  Minus,
  Factory,
  Users,
  LogOut,
  FolderOpen,
  ShieldCheck,
  Lock,
  Star,
  Link,
  BarChart3,
  WifiOff,
  ImageIcon,
  Info,
  PlayCircle,
  Eye,
  Image as ImageIconIcon,
  Upload,
  Palette,
  Combine,
  RotateCcw,
  Globe,
  Send,
  ClipboardList,
  UserX
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  where,
  getDocFromServer,
  deleteDoc
} from 'firebase/firestore';
import { LDSP_DATABASE, NORDECO_EDGE_MAPPING, LDSP_TO_EDGE_BRANDS, PRICE_LIST_CATEGORIES, SERVICES_LIST } from './constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FURNITURE_CHECKLISTS, FurnitureType } from './checklistData';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ProductionFormat = 'own' | 'contract';

const INITIAL_PRODUCT_CATEGORIES = [
  "Столешницы и стеновые",
  "Крепежные элементы и цоколь",
  "Ручки и крючки",
  "Мойки и аксессуары",
  "Петли",
  "Системы выдвижения",
  "Выдвижные корзины",
  "Подъёмные механизмы",
  "Освещение",
  "Оснащение шкафов"
];

interface ContractServiceConfig {
  enabled: boolean;
  calculateForClients: boolean;
}

interface ContractConfig {
  cabinet: ContractServiceConfig;
  facades: ContractServiceConfig;
  hardware: ContractServiceConfig;
  assembly: ContractServiceConfig;
  delivery: ContractServiceConfig;
  city: string;
  productionId: string;
}

interface LdspBrandFormat {
  id: string;
  brand: string;
  format: string;
}

interface OwnProductionConfig {
  ldspBrands: LdspBrandFormat[];
  edgeTypes: { eva: boolean; pur: boolean };
  edgeThicknesses: Record<string, boolean>;
  drilling: { cnc: boolean; manual: boolean };
  facades: Record<string, boolean>;
  customFacades: string[];
  address: string;
  photos: string[];
  edgeMultiplicity?: Record<string, number>; // "brandId:thickness" -> multiplicity
  salonCoefficients?: Record<string, Record<string, number>>; // salonId -> { category -> coefficient }
  specialConditionIds?: string[]; // IDs of salons with special conditions enabled
  standardCoefficients?: Record<string, number>; // standard coefficients for all salons
}

const CITIES = ['Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург', 'Новосибирск', 'Краснодар'];
const PRODUCTIONS: Record<string, { id: string, name: string }[]> = {
  'Москва': [{ id: 'p1', name: 'Фабрика МСК' }, { id: 'p2', name: 'Распил-Центр' }],
  'Санкт-Петербург': [{ id: 'p3', name: 'Нева-Мебель' }],
  'Казань': [{ id: 'p4', name: 'ТатРаспил' }],
  'Екатеринбург': [{ id: 'p5', name: 'УралФасад' }],
  'Новосибирск': [{ id: 'p6', name: 'СибМебель' }],
  'Краснодар': [{ id: 'p7', name: 'ЮгРаспил' }],
};

const ProductionView = ({
  productionFormat,
  setProductionFormat,
  contractConfig,
  setContractConfig,
  ownProductionConfig,
  setOwnProductionConfig,
  companyType,
  companyId,
  onSaveConfig,
  showPrompt,
  productCategories,
  allCompanies,
  manufacturerCoefficients,
  setShowManufacturerCoeffs,
  isGluingMode,
  setIsGluingMode,
  selectedForGlue,
  setSelectedForGlue,
  sheetConfigs
}: {
  productionFormat: ProductionFormat;
  setProductionFormat: React.Dispatch<React.SetStateAction<ProductionFormat>>;
  contractConfig: ContractConfig;
  setContractConfig: React.Dispatch<React.SetStateAction<ContractConfig>>;
  ownProductionConfig: OwnProductionConfig;
  setOwnProductionConfig: React.Dispatch<React.SetStateAction<OwnProductionConfig>>;
  companyType?: string;
  companyId?: string;
  onSaveConfig: () => void;
  showPrompt: (title: string, message: string, defaultValue: string, onConfirm: (value: string) => void) => void;
  productCategories: string[];
  allCompanies: any[];
  manufacturerCoefficients: any;
  setShowManufacturerCoeffs: (show: boolean) => void;
  isGluingMode: boolean;
  setIsGluingMode: (val: boolean) => void;
  selectedForGlue: string[];
  setSelectedForGlue: React.Dispatch<React.SetStateAction<string[]>>;
  sheetConfigs: Record<string, any>;
}) => {
  const [manufacturerSettings, setManufacturerSettings] = React.useState<any>(null);

  React.useEffect(() => {
    if (contractConfig.productionId) {
      const unsub = onSnapshot(doc(db, 'companies', contractConfig.productionId, 'settings', 'production'), (snap) => {
        if (snap.exists()) {
          setManufacturerSettings(snap.data());
        } else {
          setManufacturerSettings(null);
        }
      });
      return unsub;
    } else {
      setManufacturerSettings(null);
    }
  }, [contractConfig.productionId]);

  const updateContractConfig = (key: keyof ContractConfig, field: keyof ContractServiceConfig, value: boolean) => {
    setContractConfig(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] as ContractServiceConfig),
        [field]: value
      }
    }));
  };

  // Force production format based on company type
  React.useEffect(() => {
    if (companyType === 'Мебельное производство') {
      if (productionFormat !== 'own') {
        setProductionFormat('own');
      }
    } else {
      if (productionFormat !== 'contract') {
        setProductionFormat('contract');
      }
    }
  }, [companyType, productionFormat, setProductionFormat]);

  const handleAddBrand = () => {
    setOwnProductionConfig(prev => ({
      ...prev,
      ldspBrands: [...prev.ldspBrands, { id: Math.random().toString(36).substr(2, 9), brand: '', format: '' }]
    }));
  };

  const handleUpdateBrand = (id: string, field: 'brand' | 'format', value: string) => {
    setOwnProductionConfig(prev => ({
      ...prev,
      ldspBrands: prev.ldspBrands.map(b => b.id === id ? { ...b, [field]: value } : b)
    }));
  };

  const handleRemoveBrand = (id: string) => {
    setOwnProductionConfig(prev => ({
      ...prev,
      ldspBrands: prev.ldspBrands.filter(b => b.id !== id)
    }));
  };

  const productionsInCity = useMemo(() => {
    if (!contractConfig.city) return [];
    return allCompanies.filter(c => 
      c.city === contractConfig.city && 
      c.type === 'Мебельное производство'
    );
  }, [allCompanies, contractConfig.city]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Производство</h2>
        <p className="text-sm text-gray-500">
          {companyType === 'Мебельное производство' 
            ? 'Настройка параметров собственного производства' 
            : 'Настройка взаимодействия с контрактным производством'}
        </p>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-8">
        {(productionFormat === 'own' || companyType === 'Мебельное производство') && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-4">Данные производства</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Настройки формата листов</label>
                  <p className="text-sm text-gray-500 mb-3">Укажите бренды, с которыми вы работаете, и форматы листов</p>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-4 mb-2 px-2">
                      <div className="text-sm font-medium text-gray-500">Бренд</div>
                      <div className="text-sm font-medium text-gray-500">Формат листа (мм)</div>
                      <div className="w-10"></div>
                    </div>
                    
                    {ownProductionConfig.ldspBrands.map((brand) => (
                      <div key={brand.id} className="grid grid-cols-[1fr_1fr_auto] gap-4 items-center">
                        <input 
                          type="text"
                          value={brand.brand}
                          onChange={(e) => handleUpdateBrand(brand.id, 'brand', e.target.value)}
                          placeholder="Например, Egger"
                          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <input 
                          type="text"
                          value={brand.format}
                          onChange={(e) => handleUpdateBrand(brand.id, 'format', e.target.value)}
                          placeholder="Например, 2800x2070"
                          className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <button
                          onClick={() => handleRemoveBrand(brand.id)}
                          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    
                    <button
                      onClick={handleAddBrand}
                      className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 mt-2"
                    >
                      <Plus className="w-4 h-4" />
                      Добавить бренд
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Кромкооблицовка</label>
                  <div className="flex gap-6 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={ownProductionConfig.edgeTypes.eva}
                        onChange={(e) => setOwnProductionConfig(prev => ({ ...prev, edgeTypes: { ...prev.edgeTypes, eva: e.target.checked } }))}
                        className="w-5 h-5 text-blue-600 rounded border-gray-300" 
                      />
                      <span>EVA</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={ownProductionConfig.edgeTypes.pur}
                        onChange={(e) => setOwnProductionConfig(prev => ({ ...prev, edgeTypes: { ...prev.edgeTypes, pur: e.target.checked } }))}
                        className="w-5 h-5 text-blue-600 rounded border-gray-300" 
                      />
                      <span>PUR</span>
                    </label>
                  </div>
                  
                  <label className="block text-sm font-bold text-gray-700 mb-2">Применяемая толщина кромок (мм)</label>
                  <div className="flex flex-wrap gap-4">
                    {['0.4', '0.8', '1.0', '2.0'].map(thickness => (
                      <label key={thickness} className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={ownProductionConfig.edgeThicknesses[thickness] || false}
                          onChange={(e) => setOwnProductionConfig(prev => ({ 
                            ...prev, 
                            edgeThicknesses: { ...prev.edgeThicknesses, [thickness]: e.target.checked } 
                          }))}
                          className="w-5 h-5 text-blue-600 rounded border-gray-300" 
                        />
                        <span>{thickness}</span>
                      </label>
                    ))}
                  </div>

                  {Object.values(ownProductionConfig.edgeThicknesses).some(v => v) && ownProductionConfig.ldspBrands.length > 0 && (
                    <div className="mt-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                      <label className="block text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        Кратность покупки кромки (м)
                      </label>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-blue-100">
                              <th className="text-left py-2 px-2 text-gray-500 font-bold uppercase tracking-wider">Бренд / Толщина</th>
                              {['0.4', '0.8', '1.0', '2.0']
                                .filter(t => ownProductionConfig.edgeThicknesses[t])
                                .map(t => (
                                  <th key={t} className="text-center py-2 px-2 text-gray-500 font-bold uppercase tracking-wider">{t} мм</th>
                                ))}
                            </tr>
                          </thead>
                          <tbody>
            {ownProductionConfig.ldspBrands.filter(b => b.brand && b.brand !== 'ХДФ' && b.brand !== 'ДВП').flatMap((brand) => {
                              const edgeBrands = LDSP_TO_EDGE_BRANDS[brand.brand] || [];
                              if (edgeBrands.length === 0) return [{ brand, edgeBrand: null }];
                              return edgeBrands.map(eb => ({ brand, edgeBrand: eb }));
                            }).map(({ brand, edgeBrand }) => (
                              <tr key={`${brand.id}-${edgeBrand || 'none'}`} className="border-t border-blue-50">
                                <td className="py-2 px-2 font-bold text-gray-700">
                                  {brand.brand}
                                  {edgeBrand && <div className="text-[10px] font-normal text-gray-400 uppercase tracking-tighter">{edgeBrand}</div>}
                                </td>
                                {['0.4', '0.8', '1.0', '2.0']
                                  .filter(t => ownProductionConfig.edgeThicknesses[t])
                                  .map(t => {
                                    const mKey = edgeBrand ? `${brand.brand}:${edgeBrand}:${t}` : `${brand.brand}:${t}`;
                                    return (
                                      <td key={t} className="py-2 px-2">
                                        <input 
                                          type="number"
                                          min="1"
                                          step="1"
                                          value={ownProductionConfig.edgeMultiplicity?.[mKey] || ''}
                                          onChange={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            setOwnProductionConfig(prev => ({
                                              ...prev,
                                              edgeMultiplicity: {
                                                ...(prev.edgeMultiplicity || {}),
                                                [mKey]: val
                                              }
                                            }));
                                          }}
                                          placeholder="1"
                                          className="w-16 mx-auto block px-2 py-1 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-center font-bold"
                                        />
                                      </td>
                                    );
                                  })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[10px] text-blue-400 mt-2 italic">* Укажите кратность (например, 100), если кромка продается целыми рулонами. Если не заполнено, расчет идет по фактическому количеству. Наценка применяется к фактическому расходу.</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Присадка</label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={ownProductionConfig.drilling.cnc}
                        onChange={(e) => setOwnProductionConfig(prev => ({ ...prev, drilling: { ...prev.drilling, cnc: e.target.checked } }))}
                        className="w-5 h-5 text-blue-600 rounded border-gray-300" 
                      />
                      <span>ЧПУ</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={ownProductionConfig.drilling.manual}
                        onChange={(e) => setOwnProductionConfig(prev => ({ ...prev, drilling: { ...prev.drilling, manual: e.target.checked } }))}
                        className="w-5 h-5 text-blue-600 rounded border-gray-300" 
                      />
                      <span>Ручная присадка</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Изготовление фасадов</label>
                  <p className="text-sm text-gray-500 mb-3">Отметьте изготавливаемые типы фасадов или добавьте свои</p>
                  <div className="space-y-2 mb-3">
                    {['Пленка ПВХ', 'Эмаль', 'Пластик', 'Шпон', 'Массив'].map(facade => (
                      <label key={facade} className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={ownProductionConfig.facades[facade] || false}
                          onChange={(e) => setOwnProductionConfig(prev => ({ 
                            ...prev, 
                            facades: { ...prev.facades, [facade]: e.target.checked } 
                          }))}
                          className="w-5 h-5 text-blue-600 rounded border-gray-300" 
                        />
                        <span>{facade}</span>
                      </label>
                    ))}
                  </div>
                  <input 
                    type="text"
                    placeholder="Добавить свой тип фасадов..."
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        const val = e.currentTarget.value.trim();
                        setOwnProductionConfig(prev => ({
                          ...prev,
                          customFacades: [...prev.customFacades, val],
                          facades: { ...prev.facades, [val]: true }
                        }));
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  {ownProductionConfig.customFacades.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {ownProductionConfig.customFacades.map(facade => (
                        <label key={facade} className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={ownProductionConfig.facades[facade] || false}
                            onChange={(e) => setOwnProductionConfig(prev => ({ 
                              ...prev, 
                              facades: { ...prev.facades, [facade]: e.target.checked } 
                            }))}
                            className="w-5 h-5 text-blue-600 rounded border-gray-300" 
                          />
                          <span>{facade}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Адрес производства</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MapPin className="h-5 w-5 text-gray-400" />
                    </div>
                    <input 
                      type="text"
                      value={ownProductionConfig.address}
                      onChange={(e) => setOwnProductionConfig(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="г. Москва, ул. Производственная, д. 1"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Фотографии производства (до 10 шт)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
                    {ownProductionConfig.photos.map((photo, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group border border-gray-100">
                        <img src={photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button 
                          onClick={() => setOwnProductionConfig(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }))}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {ownProductionConfig.photos.length < 10 && (
                      <div className="relative">
                        <input 
                          type="file"
                          accept="image/*"
                          multiple
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length === 0) return;
                            
                            files.forEach(file => {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const base64 = event.target?.result as string;
                                setOwnProductionConfig(prev => {
                                  if (prev.photos.length >= 10) return prev;
                                  return { ...prev, photos: [...prev.photos, base64] };
                                });
                              };
                              reader.readAsDataURL(file);
                            });
                          }}
                        />
                        <div className="aspect-square border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 hover:border-blue-300 hover:text-blue-500 transition-all">
                          <Plus className="w-6 h-6 mb-1" />
                          <span className="text-[10px] font-bold text-center px-1">Загрузить с ПК</span>
                        </div>
                      </div>
                    )}
                    {ownProductionConfig.photos.length < 10 && (
                      <div 
                        onClick={() => {
                          showPrompt('Добавить фото по ссылке', 'Введите URL фотографии:', '', (url) => {
                            if (url) setOwnProductionConfig(prev => ({ ...prev, photos: [...prev.photos, url] }));
                          });
                        }}
                        className="aspect-square border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 hover:border-blue-300 hover:text-blue-500 transition-all cursor-pointer"
                      >
                        <Link className="w-6 h-6 mb-1" />
                        <span className="text-[10px] font-bold text-center px-1">По ссылке</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400">Выберите файлы на компьютере или добавьте прямую ссылку на изображение</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {productionFormat === 'contract' && (
          <div className="space-y-8">
            {contractConfig.productionId && (
              <div className="space-y-6">
                <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                      <Factory className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-gray-900 leading-none mb-1">Выбранное производство</h4>
                      <div className="flex flex-col">
                        <p className="text-sm text-blue-600 font-bold uppercase tracking-wider">
                          {allCompanies.find(c => c.id === contractConfig.productionId)?.name || '...'}
                        </p>
                        {manufacturerSettings?.address && (
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {manufacturerSettings.address}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {manufacturerCoefficients ? (
                    <button 
                      onClick={() => setShowManufacturerCoeffs(true)}
                      className="px-6 py-3 bg-white text-blue-600 rounded-2xl font-bold hover:bg-blue-600 hover:text-white transition-all shadow-sm flex items-center gap-2 active:scale-95"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Показать коэффициенты
                    </button>
                  ) : (
                    <div className="text-xs font-bold text-gray-400 bg-gray-100/50 px-4 py-2 rounded-xl border border-gray-200/50 italic">
                      Коэффициенты еще не настроены производством
                    </div>
                  )}
                </div>

                {manufacturerSettings?.photos && manufacturerSettings.photos.length > 0 && (
                  <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                    <h4 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">Фотографии производства</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                      {manufacturerSettings.photos.map((photo: string, idx: number) => (
                        <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-white shadow-sm hover:scale-105 transition-transform">
                          <img src={photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">Что для вас выполняет контрактное производство?</h3>
              
              <div className="space-y-3">
                {[
                  { id: 'cabinet', label: 'Изготовление корпуса' },
                  { id: 'facades', label: 'Изготовление/заказ фасадов' },
                  { id: 'hardware', label: 'Поставка фурнитуры' },
                  { id: 'assembly', label: 'Оказание услуг сборки' },
                  { id: 'delivery', label: 'Оказание услуг доставки' }
                ].map(item => (
                  <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="flex items-center gap-3 min-w-[280px] cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={(contractConfig as any)[item.id].enabled}
                        onChange={(e) => updateContractConfig(item.id as any, 'enabled', e.target.checked)}
                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className="font-bold text-gray-800">{item.label}</span>
                    </label>
                    
                    {(contractConfig as any)[item.id].enabled && (
                      <label className="flex items-center gap-3 cursor-pointer text-sm text-gray-600 ml-8 sm:ml-0">
                        <input 
                          type="checkbox" 
                          checked={(contractConfig as any)[item.id].calculateForClients}
                          onChange={(e) => updateContractConfig(item.id as any, 'calculateForClients', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="font-medium">Считаю для своих клиентов в этом же калькуляторе</span>
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-gray-100">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Ваш город</label>
                <select 
                  value={contractConfig.city}
                  onChange={(e) => setContractConfig(prev => ({ ...prev, city: e.target.value, productionId: '' }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Выберите город</option>
                  {CITIES.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Производство</label>
                <select 
                  value={contractConfig.productionId}
                  onChange={(e) => setContractConfig(prev => ({ ...prev, productionId: e.target.value }))}
                  disabled={!contractConfig.city}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400 bg-white"
                >
                  <option value="">Выберите производство</option>
                  {productionsInCity.map(prod => (
                    <option key={prod.id} value={prod.id}>{prod.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="pt-8 border-t border-gray-100 flex justify-end">
          <button
            onClick={() => onSaveConfig()}
            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            Сохранить настройки
          </button>
        </div>
      </div>
    </div>
  );
};

interface Detail {
  type: string;
  name: string;
  height: number;
  edgeProc: string;
  width: number;
  thickness: number;
  qty: number;
  color: string;
  area: number;
  edgeLength: number;
  edgeSides?: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  };
  packedX?: number;
  packedY?: number;
  label?: string;
  rotated?: boolean;
}

interface SheetConfig {
  width: number;
  height: number;
  name?: string;
}

interface DeliveryTariffs {
  basePrice: number;
  baseDistance: number;
  baseVolume: number;
  extraKmPrice: number;
  extraVolumePrice: number;
  extraLoaderPrice: number;
  loadingBase: number;
  floorPrice: number;
  elevatorPrice: number;
}

const LDSP_BRANDS = [
  { name: 'Kronospan (2800x2070)', width: 2800, height: 2070 },
  { name: 'Egger (2800x2070)', width: 2800, height: 2070 },
  { name: 'Lamarty (2750x1830)', width: 2750, height: 1830 },
  { name: 'Nordeco (2800x2070)', width: 2800, height: 2070 },
  { name: 'Uvadrev (2440x1830)', width: 2440, height: 1830 },
  { name: 'Evosoft (2800x1220)', width: 2800, height: 1220 },
];

const FACADE_BRANDS: Record<string, SheetConfig> = {
  'AGT': { width: 2800, height: 1220 },
  'AGT SUPRAMATT': { width: 2800, height: 1220 },
  'Evogloss': { width: 2800, height: 1220 },
  'Evosoft': { width: 2800, height: 1220 },
  'Arkopa': { width: 2800, height: 1220 },
};

// Optimized Packing Algorithm with 'First Fit' across all sheets
const packDetails = (details: Detail[], sheetWidth: number, sheetHeight: number, kerf: number = 4, allowRotation: boolean = false, mode: 'nesting' | 'saw' = 'saw') => {
  const sheets: Detail[][] = [];
  
  // Sort by area descending for better packing
  const sortedDetails = [...details].sort((a, b) => (b.width * b.height) - (a.width * a.height));

  if (mode === 'saw') {
    // Saw Center: Shelf packing with First Fit across sheets
    interface Shelf {
      y: number;
      height: number;
      usedX: number;
    }
    const sheetShelves: Shelf[][] = [];

    for (const detail of sortedDetails) {
      let placed = false;
      const orientations = allowRotation ? [[detail.width, detail.height, false], [detail.height, detail.width, true]] : [[detail.width, detail.height, false]];

      for (const [w, h, isRotated] of orientations as [number, number, boolean][]) {
        if (placed) break;

        // Try existing sheets
        for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
          const shelves = sheetShelves[sIdx];
          
          // Try existing shelves in this sheet
          for (const shelf of shelves) {
            if (h <= shelf.height && shelf.usedX + w + kerf <= sheetWidth) {
              sheets[sIdx].push({ ...detail, width: w, height: h, packedX: shelf.usedX, packedY: shelf.y, label: `${w}x${h}`, rotated: isRotated });
              shelf.usedX += w + kerf;
              placed = true;
              break;
            }
          }
          if (placed) break;

          // Try creating a new shelf in this sheet
          const lastShelf = shelves[shelves.length - 1];
          const nextY = lastShelf ? lastShelf.y + lastShelf.height + kerf : 0;
          if (nextY + h + kerf <= sheetHeight && w + kerf <= sheetWidth) {
            const newShelf = { y: nextY, height: h, usedX: w + kerf };
            shelves.push(newShelf);
            sheets[sIdx].push({ ...detail, width: w, height: h, packedX: 0, packedY: nextY, label: `${w}x${h}`, rotated: isRotated });
            placed = true;
            break;
          }
        }
      }

      if (!placed) {
        // Create new sheet
        const [w, h, isRotated] = orientations[0] as [number, number, boolean];
        if (w + kerf <= sheetWidth && h + kerf <= sheetHeight) {
          sheets.push([{ ...detail, width: w, height: h, packedX: 0, packedY: 0, label: `${w}x${h}`, rotated: isRotated }]);
          sheetShelves.push([{ y: 0, height: h, usedX: w + kerf }]);
        } else if (allowRotation) {
          const [w2, h2, isRotated2] = orientations[1] as [number, number, boolean];
          if (w2 + kerf <= sheetWidth && h2 + kerf <= sheetHeight) {
            sheets.push([{ ...detail, width: w2, height: h2, packedX: 0, packedY: 0, label: `${w2}x${h2}`, rotated: isRotated2 }]);
            sheetShelves.push([{ y: 0, height: h2, usedX: w2 + kerf }]);
          }
        }
      }
    }
  } else {
    // Nesting: MaxRects-like First Fit across sheets
    interface Rect { x: number; y: number; w: number; h: number; }
    const sheetFreeRects: Rect[][] = [];

    for (const detail of sortedDetails) {
      let placed = false;
      const orientations = allowRotation ? [[detail.width, detail.height, false], [detail.height, detail.width, true]] : [[detail.width, detail.height, false]];

      for (const [w, h, isRotated] of orientations as [number, number, boolean][]) {
        if (placed) break;

        for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
          const freeRects = sheetFreeRects[sIdx];
          let bestRectIdx = -1;

          // Find first rectangle that fits
          for (let i = 0; i < freeRects.length; i++) {
            if (w + kerf <= freeRects[i].w && h + kerf <= freeRects[i].h) {
              bestRectIdx = i;
              break;
            }
          }

          if (bestRectIdx !== -1) {
            const r = freeRects.splice(bestRectIdx, 1)[0];
            sheets[sIdx].push({ ...detail, width: w, height: h, packedX: r.x, packedY: r.y, label: `${w}x${h}`, rotated: isRotated });
            
            // Split remaining space (Guillotine)
            if (r.w - (w + kerf) > r.h - (h + kerf)) {
              if (r.w - (w + kerf) > 0) freeRects.push({ x: r.x + w + kerf, y: r.y, w: r.w - (w + kerf), h: r.h });
              if (r.h - (h + kerf) > 0) freeRects.push({ x: r.x, y: r.y + h + kerf, w: w + kerf, h: r.h - (h + kerf) });
            } else {
              if (r.h - (h + kerf) > 0) freeRects.push({ x: r.x, y: r.y + h + kerf, w: r.w, h: r.h - (h + kerf) });
              if (r.w - (w + kerf) > 0) freeRects.push({ x: r.x + w + kerf, y: r.y, w: r.w - (w + kerf), h: h + kerf });
            }
            freeRects.sort((a, b) => (a.w * a.h) - (b.w * b.h));
            placed = true;
            break;
          }
        }
      }

      if (!placed) {
        // Create new sheet
        const [w, h, isRotated] = orientations[0] as [number, number, boolean];
        if (w + kerf <= sheetWidth && h + kerf <= sheetHeight) {
          sheets.push([{ ...detail, width: w, height: h, packedX: 0, packedY: 0, label: `${w}x${h}`, rotated: isRotated }]);
          const freeRects = [];
          if (sheetWidth - (w + kerf) > sheetHeight - (h + kerf)) {
             if (sheetWidth - (w + kerf) > 0) freeRects.push({ x: w + kerf, y: 0, w: sheetWidth - (w + kerf), h: sheetHeight });
             if (sheetHeight - (h + kerf) > 0) freeRects.push({ x: 0, y: h + kerf, w: w + kerf, h: sheetHeight - (h + kerf) });
          } else {
             if (sheetHeight - (h + kerf) > 0) freeRects.push({ x: 0, y: h + kerf, w: sheetWidth, h: sheetHeight - (h + kerf) });
             if (sheetWidth - (w + kerf) > 0) freeRects.push({ x: w + kerf, y: 0, w: sheetWidth - (w + kerf), h: h + kerf });
          }
          sheetFreeRects.push(freeRects);
          placed = true;
        } else if (allowRotation) {
          const [w2, h2, isRotated2] = orientations[1] as [number, number, boolean];
          if (w2 + kerf <= sheetWidth && h2 + kerf <= sheetHeight) {
            sheets.push([{ ...detail, width: w2, height: h2, packedX: 0, packedY: 0, label: `${w2}x${h2}`, rotated: isRotated2 }]);
            const freeRects = [];
            if (sheetWidth - (w2 + kerf) > sheetHeight - (h2 + kerf)) {
               if (sheetWidth - (w2 + kerf) > 0) freeRects.push({ x: w2 + kerf, y: 0, w: sheetWidth - (w2 + kerf), h: sheetHeight });
               if (sheetHeight - (h2 + kerf) > 0) freeRects.push({ x: 0, y: h2 + kerf, w: w2 + kerf, h: sheetHeight - (h2 + kerf) });
            } else {
               if (sheetHeight - (h2 + kerf) > 0) freeRects.push({ x: 0, y: h2 + kerf, w: sheetWidth, h: sheetHeight - (h2 + kerf) });
               if (sheetWidth - (w2 + kerf) > 0) freeRects.push({ x: w2 + kerf, y: 0, w: sheetWidth - (w2 + kerf), h: h2 + kerf });
            }
            sheetFreeRects.push(freeRects);
            placed = true;
          }
        }
      }
    }
  }

  return sheets;
};

const PriceView = ({ 
  calcMode, 
  prices, 
  setPrices,
  canEditCabinet,
  canEditFacades,
  catalogServices,
  productionSettings,
  productionFormat,
  isProduction
}: { 
  calcMode: string; 
  prices: Record<string, number>; 
  setPrices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  canEditCabinet: boolean;
  canEditFacades: boolean;
  catalogServices: any[];
  productionSettings?: any;
  productionFormat: string;
  isProduction: boolean;
}) => {
  const [priceSearch, setPriceSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());

  const toggleCategory = (title: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const toggleBrand = (brand: string) => {
    setExpandedBrands(prev => {
      const next = new Set(prev);
      if (next.has(brand)) next.delete(brand);
      else next.add(brand);
      return next;
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Прайс-лист материалов</h2>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Поиск ..." 
              value={priceSearch}
              onChange={(e) => setPriceSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {PRICE_LIST_CATEGORIES.map(cat => (
          <button
            key={cat.title}
            onClick={() => toggleCategory(cat.title)}
            className={cn(
              "p-4 rounded-xl border-2 transition-all text-left flex flex-col justify-between h-24 group",
              expandedCategories.has(cat.title) 
                ? "border-blue-500 bg-blue-50/50 shadow-md" 
                : "border-gray-100 bg-white hover:border-blue-200 hover:shadow-sm"
            )}
          >
            <div className="flex justify-between items-start">
              <span className={cn(
                "font-bold text-base leading-tight",
                expandedCategories.has(cat.title) ? "text-blue-700" : "text-gray-700"
              )}>
                {cat.title}
              </span>
              <div className={cn(
                "w-6 h-6 rounded-lg flex items-center justify-center transition-colors",
                expandedCategories.has(cat.title) ? "bg-blue-100 text-blue-600" : "bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500"
              )}>
                {expandedCategories.has(cat.title) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </div>
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
              {cat.brands.length} разделов
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {PRICE_LIST_CATEGORIES.filter(cat => expandedCategories.has(cat.title)).map(cat => (
          <div key={cat.title} className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3 px-2">
              <div className="h-px flex-1 bg-gray-100"></div>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">{cat.title}</h3>
              <div className="h-px flex-1 bg-gray-100"></div>
            </div>
            
            <div className="grid gap-4">
              {cat.brands.length > 0 ? (
                cat.brands.map(brand => {
                  const isServices = brand === 'Услуги';
                  const decors = isServices ? catalogServices.map(s => s.name) : (LDSP_DATABASE[brand as keyof typeof LDSP_DATABASE] || []);
                  const filtered = decors.filter(d => d.toLowerCase().includes(priceSearch.toLowerCase()));
                  if (priceSearch && filtered.length === 0) return null;

                  const isCabinetCategory = cat.title === 'ЛДСП' || cat.title === 'ХДФ' || cat.title === 'Кромка';
                  const isFacadeCategory = cat.title === 'Фасады';
                  const canEdit = isProduction || (isCabinetCategory && canEditCabinet) || (isFacadeCategory && canEditFacades) || isServices;

                  return (
                    <div key={brand} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                      <button 
                        onClick={() => toggleBrand(brand)}
                        className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isServices ? <Wrench className="w-5 h-5 text-blue-600" /> : <Database className="w-5 h-5 text-blue-600" />}
                          <span className="font-bold text-gray-800">{brand}</span>
                          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{decors.length}</span>
                        </div>
                        {expandedBrands.has(brand) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>
                      
                      {expandedBrands.has(brand) && (
                        <div className="p-4">
                          {isServices && catalogServices.length === 0 ? (
                            <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                              <Wrench className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                              <p>Список услуг пуст.</p>
                              <p className="text-sm mt-1">Добавьте услуги в разделе "Услуги", чтобы установить на них цены.</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                              {filtered.map(decor => {
                                const service = isServices ? catalogServices.find(s => s.name === decor) : null;
                                const unit = isServices ? service?.unit : (calcMode === 'area' ? 'м²' : 'лист');
                                const priceKey = isServices ? decor : `${brand}|${decor}`;
                                
                                return (
                                  <div key={decor} className="p-2 border border-gray-100 rounded-lg hover:border-blue-200 transition-colors group bg-white shadow-sm">
                                    <div className="text-[11px] font-bold text-gray-700 mb-1.5 truncate" title={decor}>{decor}</div>
                                    {productionFormat === 'contract' && productionSettings?.prices?.[priceKey] !== undefined && (
                                      <div className="text-[9px] text-blue-600 mb-1 font-medium">
                                        Пр-во: {(productionSettings.prices[priceKey] ?? 0).toLocaleString()} ₽
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                      <input 
                                        type="text" 
                                        inputMode="decimal"
                                        value={prices[priceKey] || ''}
                                        onChange={(e) => {
                                          const v = e.target.value.replace(',', '.');
                                          if (v === '' || /^\d*\.?\d*$/.test(v)) {
                                            setPrices(prev => ({ ...prev, [priceKey]: v === '' ? 0 : parseFloat(v) }));
                                          }
                                        }}
                                        placeholder="0"
                                        disabled={!canEdit}
                                        className={cn(
                                          "w-full text-[11px] border-b border-gray-200 focus:border-blue-500 outline-none py-0.5 px-0.5 font-bold",
                                          canEdit ? "group-hover:bg-blue-50/30 text-gray-900" : "bg-gray-50 text-gray-500 cursor-not-allowed"
                                        )}
                                      />
                                      <span className="text-[9px] text-gray-400 whitespace-nowrap">₽/{unit}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <p className="text-gray-400 text-sm">В этом разделе пока нет элементов</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CalculatorView = ({
  handleFileUpload,
  handleCuttingTypeChange,
  cuttingType,
  kerf,
  setKerf,
  results,
  selectedDecor,
  setSelectedDecor,
  searchQuery,
  setSearchQuery,
  filteredDecors,
  updateSheetConfig,
  setEdgeDecor,
  facadeType,
  setFacadeType,
  facadeSearchQuery,
  setFacadeSearchQuery,
  filteredFacadeDecors,
  edgeDecor,
  edgeToEdge,
  toggleEdgeToEdge,
  expandedResults,
  toggleExpanded,
  sheetConfigs,
  trimming,
  rotations,
  toggleRotation,
  edgeThickness,
  setEdgeThickness,
  facadeCustomType,
  setFacadeCustomType,
  facadeCategory,
  setFacadeCategory,
  facadeMilling,
  setFacadeMilling,
  facadeThicknessOverride,
  setFacadeThicknessOverride,
  filteredHdfDecors,
  onSaveProject,
  currentProjectId,
  currentProjectName,
  onNewProject,
  showPrompt,
  showConfirm,
  productionFormat,
  productionSettings,
  ownProductionConfig,
  mergedMaterials,
  setMergedMaterials,
  isGluingMode,
  setIsGluingMode,
  selectedForGlue,
  setSelectedForGlue
}: {
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleCuttingTypeChange: (type: 'nesting' | 'saw') => void;
  cuttingType: 'nesting' | 'saw';
  kerf: number;
  setKerf: React.Dispatch<React.SetStateAction<number>>;
  results: any;
  selectedDecor: Record<string, string>;
  setSelectedDecor: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filteredDecors: { brand: string; name: string }[];
  filteredHdfDecors: { brand: string; name: string }[];
  updateSheetConfig: (key: string, brand: SheetConfig) => void;
  setEdgeDecor: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  facadeType: Record<string, 'sheet' | 'custom'>;
  setFacadeType: React.Dispatch<React.SetStateAction<Record<string, 'sheet' | 'custom'>>>;
  facadeSearchQuery: string;
  setFacadeSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filteredFacadeDecors: { brand: string; name: string }[];
  edgeDecor: Record<string, string>;
  edgeToEdge: Record<string, boolean>;
  toggleEdgeToEdge: (key: string) => void;
  expandedResults: Set<string>;
  toggleExpanded: (key: string) => void;
  sheetConfigs: Record<string, SheetConfig>;
  trimming: number;
  rotations: Record<string, boolean>;
  toggleRotation: (key: string) => void;
  edgeThickness: Record<string, string>;
  setEdgeThickness: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  facadeCustomType: Record<string, 'Пленка' | 'Эмаль' | 'AGT SUPRAMATT PUR' | 'EVOSOFT PUR'>;
  setFacadeCustomType: React.Dispatch<React.SetStateAction<Record<string, 'Пленка' | 'Эмаль' | 'AGT SUPRAMATT PUR' | 'EVOSOFT PUR'>>>;
  facadeCategory: Record<string, string>;
  setFacadeCategory: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  facadeMilling: Record<string, string>;
  setFacadeMilling: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  facadeThicknessOverride: Record<string, string>;
  setFacadeThicknessOverride: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSaveProject: (name: string) => void;
  currentProjectId: string | null;
  currentProjectName: string | null;
  onNewProject: () => void;
  showPrompt: (title: string, message: string, defaultValue: string, onConfirm: (value: string) => void) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  productionFormat: ProductionFormat;
  productionSettings: any;
  ownProductionConfig: OwnProductionConfig;
  mergedMaterials: Record<string, string>;
  setMergedMaterials: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isGluingMode: boolean;
  setIsGluingMode: (val: boolean) => void;
  selectedForGlue: string[];
  setSelectedForGlue: React.Dispatch<React.SetStateAction<string[]>>;
}) => {
  const handleSave = () => {
    if (currentProjectId && currentProjectName) {
      onSaveProject(currentProjectName);
    } else {
      showPrompt('Сохранить проект', 'Введите название проекта:', '', (name) => {
        if (name) onSaveProject(name);
      });
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Мебельный калькулятор</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={onNewProject}
              className="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Сбросить
            </button>
            {currentProjectId && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                <FolderOpen className="w-4 h-4" />
                <span className="text-sm font-bold truncate max-w-[200px]">{currentProjectName}</span>
                <button 
                  onClick={onNewProject}
                  className="ml-2 p-1 hover:bg-blue-200 rounded-lg transition-colors"
                  title="Новый проект"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
        
        {!results && (
          <div className="mb-8 p-5 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-start gap-4">
            <Info className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 space-y-3">
              <p>
                <strong>Важно для работы с проектом:</strong> В вашем проекте (Pro100) названия деталей должны соответствовать материалу. «ЛДСП» — ЛДСП или ДСП, все фасады должны иметь имя «Фасад». Все детали из ДВП или ХДФ должны иметь название «ДВП» или «ХДФ».
              </p>
              <p>
                В каждой детали должна присутствовать <strong>отчетность</strong>, чтобы она фигурировала в списке деталей проекта.
              </p>
              <p>
                Материалы (цвета/декоры) в проекте могут быть любыми (например, «Белый»), но в калькуляторе вы можете выбрать любой цвет из базы. Просто важно помнить, что в вашем проекте «Белый» — это, например, «Супер Белый» в расчете для клиента. Если у вас несколько видов материала с разным цветом, то в проекте они должны иметь разный цвет.
              </p>
              <p className="pt-1">
                <a href="#" className="inline-flex items-center font-bold text-blue-700 hover:text-blue-800 underline underline-offset-4 transition-colors">
                  <PlayCircle className="w-4 h-4 mr-1.5" />
                  Смотреть обучающее видео по подготовке проекта
                </a>
              </p>
            </div>
          </div>
        )}

        <div className="mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Загрузить файл отчета из Pro100 (CSV)</label>
            <div className="relative group">
              <input 
                type="file" 
                onChange={handleFileUpload} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
              />
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center group-hover:border-blue-500 transition-colors bg-white">
                <Calculator className="w-8 h-8 text-gray-400 mx-auto mb-2 group-hover:text-blue-500" />
                <span className="text-sm text-gray-500">Нажмите или перетащите файл</span>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Тип раскроя</label>
            <div className="flex gap-2 p-1 bg-gray-200 rounded-xl">
              <button 
                onClick={() => handleCuttingTypeChange('saw')} 
                className={cn(
                  "flex-1 py-2 px-4 rounded-lg font-medium transition-all",
                  cuttingType === 'saw' ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:bg-gray-300/50"
                )}
              >
                Пильный центр
              </button>
              <button 
                onClick={() => handleCuttingTypeChange('nesting')} 
                className={cn(
                  "flex-1 py-2 px-4 rounded-lg font-medium transition-all",
                  cuttingType === 'nesting' ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:bg-gray-300/50"
                )}
              >
                Нестинг
              </button>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Толщина реза (мм)</label>
              <input 
                type="number" 
                value={kerf} 
                onChange={(e) => setKerf(parseFloat(e.target.value) || 0)} 
                className="w-full border-gray-200 rounded-lg p-2 border bg-white focus:ring-2 focus:ring-blue-500 outline-none" 
              />
            </div>
          </div>
        </div>
        
        {results && (
          <div className="space-y-8">
            <div className="flex justify-end">
              <button 
                onClick={handleSave}
                className="px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 transition-all flex items-center gap-2"
              >
                <FolderOpen className="w-5 h-5" />
                {currentProjectId ? 'Обновить проект' : 'Сохранить проект'}
              </button>
            </div>
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-gray-400" />
                <h2 className="text-xl font-semibold text-gray-800">Настройка материалов</h2>
              </div>
              <div className="grid gap-4">
                {Object.keys(results).filter(key => results[key].type === 'ЛДСП' || results[key].type === 'МДФ' || results[key].type === 'ХДФ').map(key => {
                  const item = results[key];
                  return (
                    <div key={key} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            item.type === 'ХДФ' ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600"
                          )}>
                            <Database className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-bold text-gray-800 block">{item.color}</span>
                            <span className="text-xs text-gray-500">Толщина: {item.thickness} мм | Тип: {item.type}</span>
                          </div>
                        </div>
                        <div className="flex-1 max-w-md">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input 
                              type="text"
                              placeholder="Поиск ..."
                              value={selectedDecor[key] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedDecor(prev => ({ ...prev, [key]: val }));
                                setSearchQuery(val);
                              }}
                              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                            />
                            {searchQuery && selectedDecor[key] === searchQuery && (
                              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                {(item.type === 'ХДФ' ? filteredHdfDecors : filteredDecors).map(d => (
                                  <button 
                                    key={`${d.brand}|${d.name}`}
                                    onClick={() => {
                                      const selectedType = (item.type === 'ХДФ' && sheetConfigs[key]?.name) ? sheetConfigs[key].name : d.brand;
                                      const fullName = `${selectedType} ${d.name}`;
                                      setSelectedDecor(prev => ({ ...prev, [key]: fullName }));
                                      setSearchQuery('');
                                      
                                      // Auto set sheet config
                                      const brandConfig = LDSP_BRANDS.find(b => b.name.includes(d.brand));
                                      if (brandConfig) updateSheetConfig(key, brandConfig);
                                      
                                      // If we merged this material as a target of a facade, we should probably update facades too or vice versa
                                      // But let's keep it simple for now and just set decor.
                                      
                                      // Auto set edge decor
                                      if (d.brand === 'Egger' || d.brand === 'Evosoft') {
                                        setEdgeDecor(prev => ({ ...prev, [key]: d.name }));
                                      } else if (d.brand === 'Nordeco') {
                                        const mapping = NORDECO_EDGE_MAPPING[d.name];
                                        if (mapping) {
                                          const suggested = mapping.galoplast || mapping.rehau || mapping.kantenwelt;
                                          if (suggested) setEdgeDecor(prev => ({ ...prev, [key]: suggested }));
                                        }
                                      }
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0"
                                  >
                                    <span className="font-bold text-blue-600">{item.type === 'ХДФ' ? (sheetConfigs[key]?.name || 'ХДФ') : d.brand}</span> {d.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                            {item.type === 'ХДФ' ? 'Тип плиты' : 'Бренд плиты'}
                          </label>
                          <select 
                            value={sheetConfigs[key]?.name || ''}
                            onChange={(e) => {
                              if (item.type === 'ХДФ') {
                                updateSheetConfig(key, { 
                                  name: e.target.value, 
                                  width: sheetConfigs[key]?.width || 2800, 
                                  height: sheetConfigs[key]?.height || 2070 
                                });
                              } else {
                                const brand = LDSP_BRANDS.find(b => b.name.includes(e.target.value));
                                if (brand) updateSheetConfig(key, brand);
                              }
                            }}
                            className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold text-blue-600"
                          >
                            {item.type === 'ХДФ' ? (
                              <>
                                <option value="">Выберите тип...</option>
                                <option value="ХДФ">ХДФ</option>
                                <option value="ДВП">ДВП</option>
                              </>
                            ) : (
                              <>
                                <option value="">Выберите бренд...</option>
                                {LDSP_BRANDS.map(b => <option key={b.name} value={b.name}>{b.name.split(' ')[0]}</option>)}
                              </>
                            )}
                          </select>
                          <div className="mt-2 flex items-center gap-1">
                            <input 
                              type="number"
                              value={sheetConfigs[key]?.width || 2800}
                              onChange={(e) => updateSheetConfig(key, { width: parseInt(e.target.value) || 0, height: sheetConfigs[key]?.height || 2070, name: 'Custom' })}
                              className="w-1/2 p-1 border border-gray-100 rounded text-[10px] font-bold text-center focus:border-blue-300 outline-none"
                              title="Ширина листа"
                            />
                            <span className="text-[10px] text-gray-300">×</span>
                            <input 
                              type="number"
                              value={sheetConfigs[key]?.height || 2070}
                              onChange={(e) => updateSheetConfig(key, { width: sheetConfigs[key]?.width || 2800, height: parseInt(e.target.value) || 0, name: 'Custom' })}
                              className="w-1/2 p-1 border border-gray-100 rounded text-[10px] font-bold text-center focus:border-blue-300 outline-none"
                              title="Высота листа"
                            />
                          </div>
                        </div>

                        {item.type !== 'ХДФ' && (
                          <>
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Толщина кромки</label>
                              <select 
                                value={edgeThickness[key] || '0.4'}
                                onChange={(e) => setEdgeThickness(prev => ({ ...prev, [key]: e.target.value }))}
                                className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                              >
                                <option value="0.4">0.4 мм</option>
                                <option value="1">1.0 мм</option>
                                <option value="2">2.0 мм</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Декор кромки</label>
                              <input 
                                type="text"
                                placeholder="Название кромки..."
                                value={edgeDecor[key] || ''}
                                onChange={(e) => setEdgeDecor(prev => ({ ...prev, [key]: e.target.value }))}
                                className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="w-5 h-5 text-gray-400" />
                <h2 className="text-xl font-semibold text-gray-800">Настройка фасадов</h2>
              </div>
              <div className="grid gap-4">
                {Object.keys(results).filter(key => results[key].type === 'Фасад').map(key => {
                  const item = results[key];
                  return (
                    <div key={key} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                            <Calculator className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <span className="font-bold text-gray-800 block">{item.color}</span>
                            <span className="text-xs text-gray-500">Толщина: {item.thickness} мм</span>
                          </div>
                        </div>
                        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                          <button 
                            onClick={() => setFacadeType(prev => ({ ...prev, [key]: 'sheet' }))}
                            className={cn(
                              "px-3 py-1 rounded-md text-xs font-bold transition-all",
                              (facadeType[key] || 'sheet') === 'sheet' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
                            )}
                          >
                            ПЛИТНЫЕ
                          </button>
                          <button 
                            onClick={() => setFacadeType(prev => ({ ...prev, [key]: 'custom' }))}
                            className={cn(
                              "px-3 py-1 rounded-md text-xs font-bold transition-all",
                              facadeType[key] === 'custom' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
                            )}
                          >
                            ЗАКАЗНЫЕ
                          </button>
                        </div>
                      </div>
                      
                      {(facadeType[key] || 'sheet') === 'sheet' && (
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Бренд плиты</label>
                              <select 
                                onChange={(e) => {
                                  const brand = LDSP_BRANDS.find(b => b.name.includes(e.target.value)) || FACADE_BRANDS[e.target.value];
                                  if (brand) updateSheetConfig(key, brand);
                                }}
                                className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold text-blue-600"
                              >
                                <option value="">Выберите бренд...</option>
                                {LDSP_BRANDS.map(b => <option key={b.name} value={b.name}>{b.name.split(' ')[0]}</option>)}
                                {Object.keys(FACADE_BRANDS).map(b => <option key={b} value={b}>{b}</option>)}
                              </select>
                              <div className="mt-2 flex items-center gap-1">
                                <input 
                                  type="number"
                                  value={sheetConfigs[key]?.width || 2800}
                                  onChange={(e) => updateSheetConfig(key, { 
                                    width: parseInt(e.target.value) || 0, 
                                    height: sheetConfigs[key]?.height || 2070, 
                                    name: sheetConfigs[key]?.name || (item.type === 'ХДФ' ? 'ХДФ' : 'Custom') 
                                  })}
                                  className="w-1/2 p-1 border border-gray-100 rounded text-[10px] font-bold text-center focus:border-blue-300 outline-none"
                                  title="Ширина листа"
                                />
                                <span className="text-[10px] text-gray-300">×</span>
                                <input 
                                  type="number"
                                  value={sheetConfigs[key]?.height || 2070}
                                  onChange={(e) => updateSheetConfig(key, { 
                                    width: sheetConfigs[key]?.width || 2800, 
                                    height: parseInt(e.target.value) || 0, 
                                    name: sheetConfigs[key]?.name || (item.type === 'ХДФ' ? 'ХДФ' : 'Custom') 
                                  })}
                                  className="w-1/2 p-1 border border-gray-100 rounded text-[10px] font-bold text-center focus:border-blue-300 outline-none"
                                  title="Высота листа"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Декор</label>
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input 
                                  type="text"
                                  placeholder="Поиск ..."
                                  value={selectedDecor[key] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedDecor(prev => ({ ...prev, [key]: val }));
                                    setFacadeSearchQuery(val);
                                  }}
                                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                                />
                                {facadeSearchQuery && selectedDecor[key] === facadeSearchQuery && (
                                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                    {filteredFacadeDecors.map(d => (
                                      <button 
                                        key={`${d.brand}|${d.name}`}
                                        onClick={() => {
                                          const fullName = `${d.brand} ${d.name}`;
                                          setSelectedDecor(prev => ({ ...prev, [key]: fullName }));
                                          setFacadeSearchQuery('');
                                          
                                          const configToUse = (productionFormat === 'contract' && productionSettings?.production) 
                                            ? productionSettings.production 
                                            : ownProductionConfig;
                                          
                                          const customBrand = configToUse?.ldspBrands?.find((b: any) => d.brand.includes(b.brand));
                                          
                                          let brandConfig: any = null;
                                          if (customBrand && customBrand.format) {
                                            const [w, h] = customBrand.format.split('x').map((n: string) => parseInt(n));
                                            if (w && h) {
                                              brandConfig = { name: customBrand.brand, width: w, height: h };
                                            }
                                          }
                                          
                                          if (!brandConfig) {
                                            brandConfig = LDSP_BRANDS.find(b => b.name.includes(d.brand)) || FACADE_BRANDS[d.brand];
                                          }

                                          if (brandConfig) updateSheetConfig(key, brandConfig);

                                          // Auto set edge decor for facades
                                          setEdgeDecor(prev => ({ ...prev, [key]: d.name }));
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0"
                                      >
                                        <span className="font-bold text-blue-600">{d.brand}</span> {d.name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Толщина кромки</label>
                              <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 font-medium">
                                1.0 мм
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Декор кромки</label>
                              <input 
                                type="text"
                                placeholder="Название кромки..."
                                value={edgeDecor[key] || ''}
                                onChange={(e) => setEdgeDecor(prev => ({ ...prev, [key]: e.target.value }))}
                                className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Merge Logic */}
                      {(facadeType[key] || 'sheet') === 'sheet' && selectedDecor[key] && (
                        <div className="pt-2">
                          {Object.keys(results).filter(lk => results[lk].type === 'ЛДСП' && selectedDecor[lk] === selectedDecor[key]).map(lk => (
                            <div key={lk} className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100 mb-4">
                              <div className="flex items-center gap-2 text-sm text-blue-900">
                                <Combine className="w-4 h-4 text-blue-600" />
                                <span>Декор совпадает с материалом корпуса <strong>"{results[lk].color}"</strong>. Объединить в один раскрой?</span>
                              </div>
                              <div className="flex gap-2">
                                {mergedMaterials[key] === lk ? (
                                  <button 
                                    onClick={() => setMergedMaterials(prev => {
                                      const next = { ...prev };
                                      delete next[key];
                                      return next;
                                    })}
                                    className="px-3 py-1 bg-white text-blue-600 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100"
                                  >
                                    Отменить объединение
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => setMergedMaterials(prev => ({ ...prev, [key]: lk }))}
                                    className="px-4 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm"
                                  >
                                    Объединить
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {facadeType[key] === 'custom' && (
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Тип фасада</label>
                              <select 
                                value={facadeCustomType[key] || ''}
                                onChange={(e) => {
                                  const val = e.target.value as any;
                                  setFacadeCustomType(prev => ({ ...prev, [key]: val }));
                                  if (val === 'AGT SUPRAMATT PUR' || val === 'EVOSOFT PUR') {
                                    setFacadeThicknessOverride(prev => ({ ...prev, [key]: '18' }));
                                  }
                                }}
                                className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                              >
                                <option value="">Выберите тип...</option>
                                <option value="Пленка">Пленка</option>
                                <option value="Эмаль">Эмаль</option>
                                <option value="AGT SUPRAMATT PUR">AGT SUPRAMATT PUR</option>
                                <option value="EVOSOFT PUR">EVOSOFT PUR</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Толщина фасада</label>
                              {facadeCustomType[key] === 'AGT SUPRAMATT PUR' || facadeCustomType[key] === 'EVOSOFT PUR' ? (
                                <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 font-medium">
                                  18 мм
                                </div>
                              ) : (
                                <select 
                                  value={facadeThicknessOverride[key] || '16'}
                                  onChange={(e) => setFacadeThicknessOverride(prev => ({ ...prev, [key]: e.target.value }))}
                                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                >
                                  <option value="16">16 мм</option>
                                  <option value="19">19 мм</option>
                                  <option value="22">22 мм</option>
                                </select>
                              )}
                            </div>
                          </div>

                          {facadeCustomType[key] === 'Пленка' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Категория</label>
                                <select 
                                  value={facadeCategory[key] || ''}
                                  onChange={(e) => setFacadeCategory(prev => ({ ...prev, [key]: e.target.value }))}
                                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                >
                                  <option value="">Выберите категорию...</option>
                                  {[1, 2, 3, 4, 5].map(c => <option key={c} value={`Категория ${c}`}>Категория {c}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Фрезеровка</label>
                                <select 
                                  value={facadeMilling[key] || ''}
                                  onChange={(e) => setFacadeMilling(prev => ({ ...prev, [key]: e.target.value }))}
                                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                >
                                  <option value="">Выберите фрезеровку...</option>
                                  <option value="Мыло">Мыло</option>
                                  <option value="Фрезеровка ТИП 1">Фрезеровка ТИП 1</option>
                                  <option value="Фрезеровка ТИП 2">Фрезеровка ТИП 2</option>
                                  <option value="Фрезеровка ТИП 3">Фрезеровка ТИП 3</option>
                                  <option value="Фрезеровка ТИП 4">Фрезеровка ТИП 4</option>
                                </select>
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Декор фасада</label>
                            {facadeCustomType[key] === 'AGT SUPRAMATT PUR' || facadeCustomType[key] === 'EVOSOFT PUR' ? (
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input 
                                  type="text"
                                  placeholder="Поиск ..."
                                  value={selectedDecor[key] || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedDecor(prev => ({ ...prev, [key]: val }));
                                    setFacadeSearchQuery(val);
                                  }}
                                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                                />
                                {facadeSearchQuery && selectedDecor[key] === facadeSearchQuery && (
                                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                    {filteredFacadeDecors.filter(d => d.brand === facadeCustomType[key]).map(d => (
                                      <button 
                                        key={`${d.brand}|${d.name}`}
                                        onClick={() => {
                                          setSelectedDecor(prev => ({ ...prev, [key]: d.name }));
                                          setFacadeSearchQuery('');
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0"
                                      >
                                        {d.name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <input 
                                type="text"
                                placeholder="Название декора..."
                                value={selectedDecor[key] || ''}
                                onChange={(e) => setSelectedDecor(prev => ({ ...prev, [key]: e.target.value }))}
                                className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-4">
                <LayoutDashboard className="w-5 h-5 text-gray-400" />
                <h2 className="text-xl font-semibold text-gray-800">Результаты раскроя</h2>
              </div>
              {Object.entries(results).map(([key, item]: any) => {
                return (
                  <div key={key} className="mb-4 border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                    <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          item.type === 'Фасад' ? "bg-purple-50 text-purple-600" : 
                          item.type === 'ХДФ' ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600"
                        )}>
                          {item.type === 'Фасад' ? <Calculator className="w-5 h-5" /> : <Database className="w-5 h-5" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{item.name} ({item.color})</h3>
                          <p className="text-sm text-gray-500">
                            Площадь: {item.area.toFixed(2)} м²
                            {item.type !== 'ХДФ' && (item.type !== 'Фасад' || (facadeType[key] || 'sheet') === 'sheet') && `, Кромка: ${(edgeToEdge[key] || item.type === 'Фасад') ? (item.details.reduce((sum: any, d: any) => sum + ((d.width + d.height) * 2), 0) / 1000).toFixed(2) : item.edgeLength.toFixed(2)} м`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {item.type !== 'ХДФ' && item.type !== 'Фасад' && (
                          <button 
                            onClick={() => toggleEdgeToEdge(key)} 
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                              edgeToEdge[key] ? "bg-green-600 text-white shadow-md shadow-green-100" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                          >
                            Кромка в круг
                          </button>
                        )}
                        <button 
                          onClick={() => toggleExpanded(key)} 
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg font-medium transition-all shadow-md shadow-blue-100"
                        >
                          {expandedResults.has(key) ? 'Скрыть карту' : 'Показать карту'}
                        </button>
                      </div>
                    </div>
                    
                    {expandedResults.has(key) && sheetConfigs[key] && (
                      <div className="p-6 bg-gray-50 border-t border-gray-200">
                        <div className="space-y-8">
                          {(() => {
                            const sheetW = sheetConfigs[key].width - (trimming * 2);
                            const sheetH = sheetConfigs[key].height - (trimming * 2);
                            return packDetails(item.details, sheetW, sheetH, kerf, rotations[key] || false, cuttingType).map((sheet: Detail[], sheetIndex: number) => {
                              const sheetArea = sheetConfigs[key].width * sheetConfigs[key].height;
                              const usedArea = sheet.reduce((sum, d) => sum + (d.width * d.height), 0);
                              const waste = ((1 - usedArea / sheetArea) * 100).toFixed(1);
                              return (
                                <div key={sheetIndex} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                  <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">{sheetIndex + 1}</div>
                                      <div>
                                        <h4 className="font-bold text-gray-800">Лист {sheetIndex + 1}</h4>
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{sheetConfigs[key].width} × {sheetConfigs[key].height} мм</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                      {item.type !== 'ХДФ' && (
                                        <button
                                          onClick={() => setIsGluingMode(!isGluingMode)}
                                          className={cn(
                                            "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                            isGluingMode ? "bg-red-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                          )}
                                        >
                                          {isGluingMode ? 'Закончить склейку' : 'Указать склейку'}
                                        </button>
                                      )}
                                      <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer">
                                        <input 
                                          type="checkbox" 
                                          checked={rotations[key] || false} 
                                          onChange={() => toggleRotation(key)}
                                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        Вращать детали
                                      </label>
                                      <div className="flex flex-col items-end">
                                        <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Отходы</span>
                                        <span className="text-lg font-black text-blue-600">{waste}%</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="border-4 border-gray-100 relative bg-gray-50 mx-auto rounded-lg overflow-hidden" style={{ 
                                    width: '100%', 
                                    maxWidth: '1000px', 
                                    aspectRatio: `${sheetConfigs[key].width} / ${sheetConfigs[key].height}` 
                                  }}>
                                    {sheet.map((d: Detail, i: number) => {
                                      const isVertical = d.width < d.height && d.width < 120;
                                      const isTopDetail = (d.packedY! + trimming) / sheetConfigs[key].height < 0.2;
                                      const isLeftDetail = (d.packedX! + trimming) / sheetConfigs[key].width < 0.15;
                                      const isRightDetail = (d.packedX! + d.width + trimming) / sheetConfigs[key].width > 0.85;
                                      
                                      // Determine rendered edges based on orientation
                                      let eTop = d.edgeSides?.top || edgeToEdge[key];
                                      let eBottom = d.edgeSides?.bottom || edgeToEdge[key];
                                      let eLeft = d.edgeSides?.left || edgeToEdge[key];
                                      let eRight = d.edgeSides?.right || edgeToEdge[key];
                                      
                                      if (d.rotated) {
                                        // 90deg rotation mapping
                                        const old = { ...d.edgeSides };
                                        eTop = old.left;
                                        eRight = old.top;
                                        eBottom = old.right;
                                        eLeft = old.bottom;
                                      }

                                      return (
                                        <div key={i} className={cn(
                                            "bg-blue-100 border border-blue-300 text-[10px] p-1 absolute flex flex-col items-center justify-center transition-all cursor-pointer group z-10 hover:z-50",
                                            isGluingMode ? "hover:bg-red-100 border-red-300" : "hover:bg-blue-200",
                                            isGluingMode && selectedForGlue.includes(`${key}-${sheetIndex}-${i}`) && "bg-red-500 text-white border-red-700"
                                          )}
                                          onClick={() => {
                                            if (isGluingMode) {
                                              const newId = `${key}-${sheetIndex}-${i}`;
                                              setSelectedForGlue(prev => prev.includes(newId) ? prev.filter(x => x !== newId) : [...prev, newId]);
                                            }
                                          }} style={{ 
                                          left: `${((d.packedX! + trimming) / sheetConfigs[key].width) * 100}%`, 
                                          top: `${((d.packedY! + trimming) / sheetConfigs[key].height) * 100}%`, 
                                          width: `${(d.width / sheetConfigs[key].width) * 100}%`, 
                                          height: `${(d.height / sheetConfigs[key].height) * 100}%` 
                                        }}>
                                          {/* Edge Lines */}
                                          {eTop && <div className="absolute top-0 left-0 w-full h-[3px] bg-red-500 z-20" title="Кромка сверху" />}
                                          {eBottom && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-red-500 z-20" title="Кромка снизу" />}
                                          {eLeft && <div className="absolute top-0 left-0 w-[3px] h-full bg-red-500 z-20" title="Кромка слева" />}
                                          {eRight && <div className="absolute top-0 right-0 w-[3px] h-full bg-red-500 z-20" title="Кромка справа" />}

                                          <div className={cn(
                                            "flex flex-col items-center justify-center w-full h-full overflow-hidden",
                                            isVertical && "rotate-90 whitespace-nowrap"
                                          )}>
                                            <span className="font-bold text-blue-800 text-center leading-tight truncate w-full px-1">{d.name}</span>
                                            <span className="text-blue-600 font-mono mt-0.5 whitespace-nowrap">{d.width}×{d.height}</span>
                                          </div>
                                          
                                          {/* Tooltip */}
                                          <div className={cn(
                                            "absolute hidden group-hover:block bg-gray-900 text-white p-3 rounded-lg shadow-2xl z-[100] w-max max-w-[240px] text-xs mb-2 pointer-events-none",
                                            isTopDetail ? "top-full mt-2" : "bottom-full",
                                            isLeftDetail ? "left-0" : isRightDetail ? "right-0" : "left-1/2 -translate-x-1/2"
                                          )}>
                                            <div className="font-bold mb-1.5 border-b border-gray-700 pb-1.5 text-blue-400">{d.name}</div>
                                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                                              <span className="text-gray-400">Размер:</span>
                                              <span className="font-mono">{d.width} × {d.height} мм</span>
                                              {item.type !== 'ХДФ' && (
                                                <>
                                                  <span className="text-gray-400">Кромка:</span>
                                                  <span className="font-medium text-green-400">{d.edgeLength.toFixed(2)} м</span>
                                                </>
                                              )}
                                            </div>
                                            <div className={cn(
                                              "absolute border-8 border-transparent",
                                              isTopDetail ? "bottom-full border-b-gray-900" : "top-full border-t-gray-900",
                                              isLeftDetail ? "left-4" : isRightDetail ? "right-4" : "left-1/2 -translate-x-1/2"
                                            )} />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          </div>
        )}
      </div>

      {/* Old Save Modal Removed */}
    </div>
  );
};

const SummaryView = ({ 
  results, 
  selectedDecor, 
  prices, 
  facadeType, 
  sheetConfigs, 
  trimming, 
  kerf, 
  rotations, 
  cuttingType, 
  calcMode, 
  coefficients, 
  edgeToEdge, 
  edgePrices, 
  setEdgePrices, 
  edgeThickness, 
  edgeDecor, 
  setPrices,
  facadeCustomType,
  facadeCategory,
  facadeMilling,
  facadeThicknessOverride,
  hardwareKitPrice: hardwareKitPriceProps,
  addedProducts,
  addedServices,
  serviceData,
  assemblyPercentage,
  deliveryTariffs,
  canEditCabinet,
  canEditFacades,
  canEditHardware,
  canEditAssembly,
  canEditDelivery,
  customerType,
  setCustomerType,
  isProduction,
  ownProductionConfig,
  productionFormat,
  productionSettings,
  userRole,
  companyType,
  mergedMaterials,
  selectedForGlue,
  furnitureType,
  setFurnitureType,
  checklistRefused,
  setChecklistRefused
}: { 
  results: any; 
  selectedDecor: Record<string, string>; 
  prices: Record<string, number>; 
  facadeType: Record<string, 'sheet' | 'custom'>; 
  sheetConfigs: Record<string, SheetConfig>; 
  trimming: number; 
  kerf: number; 
  rotations: Record<string, boolean>; 
  cuttingType: 'nesting' | 'saw'; 
  calcMode: 'sheet' | 'area'; 
  coefficients: any; 
  edgeToEdge: Record<string, boolean>; 
  edgePrices: Record<string, number>; 
  setEdgePrices: React.Dispatch<React.SetStateAction<Record<string, number>>>; 
  edgeThickness: Record<string, string>; 
  edgeDecor: Record<string, string>; 
  setPrices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  facadeCustomType: Record<string, 'Пленка' | 'Эмаль' | 'AGT SUPRAMATT PUR' | 'EVOSOFT PUR'>;
  facadeCategory: Record<string, string>;
  facadeMilling: Record<string, string>;
  facadeThicknessOverride: Record<string, string>;
  hardwareKitPrice: number;
  addedProducts: any[];
  addedServices: any[];
  serviceData: any;
  assemblyPercentage: number;
  deliveryTariffs: DeliveryTariffs;
  canEditCabinet: boolean;
  canEditFacades: boolean;
  canEditHardware: boolean;
  canEditAssembly: boolean;
  canEditDelivery: boolean;
  customerType: 'retail' | 'wholesale' | 'designer';
  setCustomerType: (type: 'retail' | 'wholesale' | 'designer') => void;
  isProduction: boolean;
  ownProductionConfig: OwnProductionConfig;
  productionFormat: ProductionFormat;
  productionSettings: any;
  userRole?: string | null;
  companyType?: string;
  mergedMaterials: Record<string, string>;
  selectedForGlue: string[];
  furnitureType: string;
  setFurnitureType: (type: string) => void;
  checklistRefused: Record<string, boolean>;
  setChecklistRefused: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) => {
  const hardwareKitPrice = hardwareKitPriceProps;
  if (!results && addedProducts.length === 0 && addedServices.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <Calculator className="w-12 h-12 mb-4" />
      <p>Загрузите файл отчета из Pro100 для получения итогового расчета</p>
    </div>
  );

  let totalCost = 0;
  let allDataEntered = true;
  let totalLdspSheets = 0;

  const configToUse = (productionFormat === 'contract' && productionSettings?.production) 
    ? productionSettings.production 
    : ownProductionConfig;

  const summaryRows = results ? Object.entries(results).flatMap(([key, item]: any) => {
    const rows: any[] = [];
    
    // Skip if it's merged INTO another material
    if (mergedMaterials[key]) return [];

    // Material Row
    const decor = selectedDecor[key];
    const basePriceKey = typeof decor === 'string' ? decor.replace(/ /g, '|') : '';
    
    // Check if the price for this décor is manual (missing from the base config)
    const isManualMaterial = basePriceKey ? (!configToUse.prices?.[basePriceKey] || configToUse.prices?.[basePriceKey] === 0) : true;
    
    // If manual, use a unique key for this specific material row to avoid price sharing
    const priceKey = isManualMaterial ? `manual_${key}` : basePriceKey;
    const price = prices[priceKey] || 0;
    
    const isCustomFacade = item.type === 'Фасад' && facadeType[key] === 'custom';
    const isSheetFacade = item.type === 'Фасад' && (facadeType[key] || 'sheet') === 'sheet';
    
    let itemCost = 0;
    let qtyText = '';
    let coef = coefficients[item.type === 'ХДФ' ? 'hdf' : (isSheetFacade ? 'facadeSheet' : 'ldsp')] || 1;

    // Collate details for merged materials
    const combinedDetails = [...item.details];
    Object.entries(mergedMaterials).forEach(([mKey, targetKey]) => {
      if (targetKey === key && results[mKey]) {
        combinedDetails.push(...results[mKey].details);
      }
    });
    
    if (isCustomFacade) {
      const customType = facadeCustomType[key] || 'Пленка';
      const category = facadeCategory[key] || '';
      const milling = facadeMilling[key] || '';
      const thickness = facadeThicknessOverride[key] || item.thickness;
      
      itemCost = item.area * price;
      qtyText = `${item.area.toFixed(2)} м²`;

      rows.push({
        type: 'material',
        name: `Фасад (${customType})`,
        sub: `${thickness} мм${category ? `, ${category}` : ''}${milling ? `, ${milling}` : ''}`,
        decor: decor || 'Не выбран',
        qty: qtyText,
        price: price,
        rawPrice: price,
        priceKey: priceKey,
        total: Math.round(itemCost),
        coef: 1,
        key: key,
        isManual: isManualMaterial
      });
    } else {
      const sheetW = (sheetConfigs[key]?.width || 2800) - (trimming * 2);
      const sheetH = (sheetConfigs[key]?.height || 2070) - (trimming * 2);
      const sheets = packDetails(combinedDetails, sheetW, sheetH, kerf, rotations[key] || false, cuttingType);
      const sheetCount = sheets.length;
      const sheetArea = (sheetConfigs[key]?.width || 2800) * (sheetConfigs[key]?.height || 2070) / 1000000;
      
      if (item.type === 'ЛДСП' || item.type === 'МДФ') {
        totalLdspSheets += sheetCount;
      }

      if (calcMode === 'area') {
        itemCost = sheetCount * sheetArea * price * coef;
      } else {
        itemCost = sheetCount * price * coef;
      }
      qtyText = `${sheetCount} л.`;

      const showPurchasePrice = userRole === 'admin' || companyType === 'Дизайнер';
      const displayPrice = showPurchasePrice ? price : Math.round(price * coef);

      rows.push({
        type: 'material',
        name: (item.type === 'ХДФ' && sheetConfigs[key]?.name) ? sheetConfigs[key].name : item.name,
        sub: item.color,
        decor: decor || 'Не выбран',
        qty: qtyText,
        price: displayPrice,
        rawPrice: price,
        priceKey: priceKey,
        total: Math.round(itemCost),
        coef: coef,
        key: key,
        isManual: isManualMaterial
      });
    }
    
    if (price === 0) allDataEntered = false;

    // Edge Rows (Handling multiple edge types for merged materials)
    const edgeGroups: Record<string, {
      thickness: string,
      decor: string,
      qty: number,
      price: number,
      key: string,
      priceKey?: string,
      coef: number,
      totalLength: number
    }> = {};

    const clusterKeys = [key, ...Object.entries(mergedMaterials).filter(([_, target]) => target === key).map(([mKey]) => mKey)];

    clusterKeys.forEach(ck => {
      const cItem = results[ck];
      if (!cItem || cItem.type === 'ХДФ') return;
      
      const isFacade = cItem.type === 'Фасад';
      if (isFacade && facadeType[ck] === 'custom') return;

      let gluedEdgeLength = 0;
      let regularEdgeLengthToRemove = 0;
      
      const ckGluedIdPrefix = `${ck}-`;
      const gluedIds = selectedForGlue.filter(id => id.startsWith(ckGluedIdPrefix));
      
      if (gluedIds.length > 0) {
        const sheetW = (sheetConfigs[ck]?.width || 2800) - (trimming * 2);
        const sheetH = (sheetConfigs[ck]?.height || 2070) - (trimming * 2);
        const sheets = packDetails(cItem.details, sheetW, sheetH, kerf, rotations[ck] || false, cuttingType);
        
        const perimeterSum = gluedIds.reduce((sum, id) => {
          const parts = id.split('-');
          const idxStr = parts.pop()!;
          const sheetStr = parts.pop()!;
          const sIdx = parseInt(sheetStr, 10);
          const iIdx = parseInt(idxStr, 10);
          const d = sheets[sIdx]?.[iIdx];
          if (d) {
             return sum + ((d.width + d.height) * 2 / 1000);
          }
          return sum;
        }, 0);
        
        regularEdgeLengthToRemove = perimeterSum;
        gluedEdgeLength = perimeterSum / 2;
      }

      let edgeLenActual = (edgeToEdge[ck] || isFacade)
        ? (cItem.details.reduce((sum: any, d: any) => sum + ((d.width + d.height) * 2), 0) / 1000)
        : cItem.edgeLength;
        
      edgeLenActual = Math.max(0, edgeLenActual - regularEdgeLengthToRemove);

      const thickness = isFacade ? '1.0' : (edgeThickness[ck] || '0.4');
      const decor = edgeDecor[ck] || 'Не указан';
      const price = edgePrices[ck] || 0;
      const coef = coefficients.edge || 1.5;

      const groupKey = `${thickness}|${decor}`;

      if (!edgeGroups[groupKey]) {
        edgeGroups[groupKey] = {
          thickness,
          decor,
          qty: 0,
          price,
          key: ck,
          coef,
          totalLength: 0
        };
      }
      edgeGroups[groupKey].totalLength += edgeLenActual;
      
      // Glued edge row
      if (gluedEdgeLength > 0) {
        const gluedGroupKey = `glued|${ck}`;
        const priceKey = `${ck}-glued`;
        if (!edgeGroups[gluedGroupKey]) {
          edgeGroups[gluedGroupKey] = {
            thickness: 'Склейка (доп.)',
            decor: decor,
            qty: 0,
            price: edgePrices[priceKey] || 0,
            priceKey: priceKey,
            key: ck,
            coef,
            totalLength: 0
          };
        }
        edgeGroups[gluedGroupKey].totalLength += gluedEdgeLength;
      }
    });

    Object.values(edgeGroups).forEach(group => {
      const edgeLenRounded = Math.ceil(group.totalLength);
      const brandStr = selectedDecor[group.key] || '';
      const brandName = Object.keys(LDSP_DATABASE).find(b => brandStr.startsWith(b)) || '';
      const thickness = group.thickness;

      
      const detectedEdgeBrand = brandName ? LDSP_TO_EDGE_BRANDS[brandName]?.find(eb => 
        String(group.decor).toLowerCase().includes(String(eb).toLowerCase())
      ) : null;
      
      const mKey = detectedEdgeBrand 
        ? `${brandName}:${detectedEdgeBrand}:${thickness}` 
        : `${brandName}:${thickness}`;
      
      const configToUse = (productionFormat === 'contract' && productionSettings?.production) 
        ? productionSettings.production 
        : ownProductionConfig;
        
      const multiplicity = configToUse.edgeMultiplicity?.[mKey] || 0;
      
      let eCost = edgeLenRounded * group.price * group.coef;
      let displayQty = `${edgeLenRounded} м`;
      
      if (multiplicity > 0) {
        const buyLen = Math.ceil(group.totalLength / multiplicity) * multiplicity;
        if (buyLen > edgeLenRounded) {
          eCost = (buyLen * group.price) + (edgeLenRounded * group.price * (group.coef - 1));
          displayQty = `${buyLen} м`;
        }
      }

      if (group.price === 0) allDataEntered = false;

      const showPurchasePrice = userRole === 'admin' || companyType === 'Дизайнер';
      const displayPrice = showPurchasePrice ? group.price : Math.round(group.price * group.coef);

      rows.push({
        type: 'edge',
        name: String(thickness).includes('Склейка') ? 'Кромка (Склейка)' : `Кромка (${thickness} мм)`,
        sub: group.decor,
        decor: group.decor,
        qty: displayQty,
        price: displayPrice,
        total: Math.round(eCost),
        isEdge: true,
        key: group.key,
        priceKey: group.priceKey,
        coef: group.coef
      });
    });

    return rows;
  }) : [];

  const currentCoefficients = coefficients;

  const kitCost = totalLdspSheets * hardwareKitPrice;
  if (totalLdspSheets > 0) {
    summaryRows.push({
      type: 'hardware',
      name: 'Комплект метизов',
      sub: `На ${totalLdspSheets} л. ЛДСП`,
      decor: '-',
      qty: `${totalLdspSheets} шт`,
      price: hardwareKitPrice,
      total: Math.round(kitCost),
      coef: 1
    });
  }

  // Add Added Products
  addedProducts.forEach(product => {
    summaryRows.push({
      type: 'product',
      name: product.name,
      sub: product.category,
      decor: '-',
      qty: `${product.quantity} шт`,
      price: product.price,
      total: product.price * product.quantity,
      coef: 1
    });
  });

  // Add Added Services
  addedServices.forEach(service => {
    const price = service.price !== undefined ? service.price : (prices[service.name] || 0);
    const isManualService = service.price === undefined && (!configToUse.prices?.[service.name] || configToUse.prices?.[service.name] === 0);

    summaryRows.push({
      type: 'service',
      name: service.name,
      sub: service.supplier ? `От поставщика: ${service.supplier}` : 'Услуги производства',
      decor: '-',
      qty: `${service.quantity} ${service.unit}`,
      price: price,
      total: price * service.quantity,
      coef: 1,
      isManual: isManualService
    });
  });

  totalCost = summaryRows.reduce((sum, row) => sum + row.total, 0);

    // Add Assembly Fee if enabled
    if (serviceData.assembly) {
      const assemblyCoef = currentCoefficients.assembly || 1.5;
      const assemblyFee = Math.round(totalCost * (assemblyPercentage / 100) * assemblyCoef);
      summaryRows.push({
        type: 'service',
        name: 'Базовый пакет сборки',
        sub: `Сервис (${assemblyPercentage}% от стоимости)`,
        decor: '-',
        qty: '1 усл',
        price: assemblyFee,
        total: assemblyFee,
        coef: assemblyCoef
      });
      totalCost += assemblyFee;
    }
  
    // Add Delivery Fee if enabled
    if (serviceData.delivery) {
      const deliveryCoef = currentCoefficients.delivery || 1.5;
      let deliveryFee = deliveryTariffs.basePrice;
      
      if (serviceData.distance > deliveryTariffs.baseDistance) {
        deliveryFee += (serviceData.distance - deliveryTariffs.baseDistance) * deliveryTariffs.extraKmPrice;
      }
  
      // Calculate total volume (rough estimation based on sheets)
      const totalVolume = totalLdspSheets * 0.1; // Assuming 0.1m3 per sheet
      if (totalVolume > deliveryTariffs.baseVolume) {
        deliveryFee += (totalVolume - deliveryTariffs.baseVolume) * deliveryTariffs.extraVolumePrice;
      }
  
      // NEW: Loading/Lift calculation
      let loadingFee = deliveryTariffs.loadingBase;
      const floor = parseInt(serviceData.address.floor) || 0;
      if (floor > 1) {
        if (serviceData.address.elevator === 'none') {
          loadingFee += (floor - 1) * deliveryTariffs.floorPrice;
        } else {
          loadingFee += deliveryTariffs.elevatorPrice;
        }
      }
      deliveryFee += loadingFee;

      if (serviceData.extraLoader) {
        deliveryFee += deliveryTariffs.extraLoaderPrice;
      }
  
      const finalDeliveryFee = Math.round(deliveryFee * deliveryCoef);
      summaryRows.push({
        type: 'service',
        name: 'Доставка на объект',
        sub: `Сервис (${serviceData.distance} км${serviceData.extraLoader ? ', +1 грузчик' : ''}${floor > 0 ? `, ${floor} эт.` : ''})`,
        decor: '-',
        qty: '1 усл',
        price: finalDeliveryFee,
        total: finalDeliveryFee,
        coef: deliveryCoef
      });
      totalCost += finalDeliveryFee;
    }
    
  const [showChecklistWindow, setShowChecklistWindow] = useState(false);

  // Function to determine if an item is present in the summary rows
  const isItemPresent = (itemName: string) => {
    const lowerItemName = itemName.toLowerCase();
    return summaryRows.some(row => {
      const rowName = row.name.toLowerCase();
      // Simple logic: check if the row name contains the checklist item name
      // Can be refined if specific matching logic is needed.
      return rowName.includes(lowerItemName);
    });
  };

  const currentChecklist = furnitureType && furnitureType in FURNITURE_CHECKLISTS ? FURNITURE_CHECKLISTS[furnitureType as FurnitureType] : null;

  const finalTotal = allDataEntered ? Math.round(totalCost) : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {isProduction && (
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-gray-700">Тип клиента для расчета:</span>
          </div>
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            <button 
              onClick={() => setCustomerType('retail')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                customerType === 'retail' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Розница
            </button>
            <button 
              onClick={() => setCustomerType('wholesale')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                customerType === 'wholesale' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Салон
            </button>
            <button 
              onClick={() => setCustomerType('designer')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                customerType === 'designer' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Дизайнер
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Итоговый расчет проекта</h2>
        
        <div className="flex items-center gap-3">
          {currentChecklist && (
            <button
              onClick={() => setShowChecklistWindow(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
            >
              <ClipboardList className="w-4 h-4" />
              <span className="font-bold text-sm">Чек-лист</span>
            </button>
          )}

          <label className="text-sm font-bold text-gray-500 ml-4">Тип мебели:</label>
          <select 
            value={furnitureType}
            onChange={(e) => setFurnitureType(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
          >
            <option value="">Не указан</option>
            {Object.keys(FURNITURE_CHECKLISTS).map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>
      
      {currentChecklist && !showChecklistWindow && (
        <button
          onClick={() => setShowChecklistWindow(true)}
          className="fixed right-6 bottom-24 z-50 flex items-center justify-center p-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg shadow-blue-500/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-in slide-in-from-right-8 group"
        >
          <ClipboardList className="w-6 h-6 flex-shrink-0" />
          <span className="font-bold text-sm transition-all duration-300 overflow-hidden max-w-0 group-hover:max-w-[150px] group-hover:ml-2 opacity-0 group-hover:opacity-100 whitespace-nowrap">
            Чек-лист
          </span>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>
        </button>
      )}

      {showChecklistWindow && currentChecklist && (
        <div className="fixed inset-0 z-[100] flex items-center justify-end p-4 sm:p-6 pb-20 sm:pb-6 bg-black/20 backdrop-blur-sm pointer-events-auto" onClick={(e) => e.target === e.currentTarget && setShowChecklistWindow(false)}>
          <div className="w-full max-w-sm h-full max-h-[85vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-300">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 leading-tight">Чек-лист продаж</h3>
                  <p className="text-xs text-gray-500">{furnitureType}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowChecklistWindow(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 pb-10 space-y-6">
              <p className="text-sm text-gray-500 mb-2">Проверьте, не забыли ли вы предложить клиенту следующие позиции:</p>
              
              {currentChecklist.map((group, gIdx) => (
                <div key={gIdx} className="space-y-2">
                  <div className="h-px w-full bg-gradient-to-r from-gray-200 to-transparent mb-3" />
                  {group.items.map((item, idx) => {
                    const isRefused = checklistRefused[`${furnitureType}_${item}`];
                    const isPresent = isItemPresent(item);
                    
                    return (
                      <div key={idx} className={cn(
                        "flex items-center justify-between p-3 rounded-xl border transition-all group",
                        isRefused ? "bg-gray-50/50 border-gray-100 opacity-60" :
                        isPresent ? "bg-green-50/50 border-green-200" : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
                      )}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={cn(
                            "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                            isRefused ? "bg-gray-200 text-gray-500" :
                            isPresent ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"
                          )}>
                            {isRefused ? <UserX className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                          </div>
                          <span className={cn(
                            "text-sm font-medium truncate",
                            isRefused ? "text-gray-400 line-through" :
                            isPresent ? "text-green-800" : "text-gray-700"
                          )}>
                            {item}
                          </span>
                        </div>
                        
                        {!isPresent && !isRefused && (
                          <button
                            onClick={() => setChecklistRefused(prev => ({...prev, [`${furnitureType}_${item}`]: true}))}
                            className="opacity-0 group-hover:opacity-100 ml-2 px-2 py-1 text-[10px] font-bold tracking-wider uppercase bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded flex-shrink-0 transition-all"
                            title="Клиенту не надо"
                          >
                            Отказ
                          </button>
                        )}
                        
                        {isRefused && (
                          <button
                            onClick={() => {
                              const newRefused = { ...checklistRefused };
                              delete newRefused[`${furnitureType}_${item}`];
                              setChecklistRefused(newRefused);
                            }}
                            className="opacity-0 group-hover:opacity-100 ml-2 px-2 py-1 text-[10px] font-bold tracking-wider uppercase text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded flex-shrink-0 transition-all"
                            title="Вернуть в список"
                          >
                            Вернуть
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Материал / Параметры</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Декор</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Кол-во</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Цена</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Итого</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {summaryRows.filter(r => r.type === 'material' || r.type === 'edge' || r.type === 'hardware').map((row, idx) => {
              const isMaterial = row.type === 'material';
              const isFirst = idx === 0;
              const stableKey = `${row.type}-${row.key}-${idx}`;
              
              return (
                <tr key={stableKey} className={cn(
                  "hover:bg-gray-50 transition-colors", 
                  row.isEdge && "bg-gray-50/20",
                  isMaterial && !isFirst && "border-t border-gray-200/60"
                )}>
                  <td className="px-6 py-2">
                  <div className={cn(
                    "font-medium text-gray-900",
                    row.isEdge && "pl-6 flex items-center gap-2 text-gray-600 text-sm"
                  )}>
                    {row.isEdge && (
                      <div className="w-3 h-3 border-l-2 border-b-2 border-gray-300 rounded-bl-md -mt-1.5" />
                    )}
                    {row.name}
                  </div>
                  <div className={cn(
                    "text-xs text-gray-500",
                    row.isEdge && "pl-11"
                  )}>{row.sub}</div>
                </td>
                <td className="px-6 py-2">
                  <span className={cn(
                    "text-sm font-medium", 
                    row.decor === 'Не выбран' || row.decor === 'Не указан' ? "text-gray-400 italic" : "text-blue-600",
                    row.isEdge && "pl-6 text-xs text-gray-500 font-normal"
                  )}>
                    {row.decor}
                  </span>
                </td>
                <td className="px-6 py-2 text-right text-sm font-medium">
                  <span className={cn(row.isEdge && "text-xs text-gray-500")}>
                    {row.qty}
                  </span>
                </td>
                <td className="px-6 py-2 text-right text-sm font-medium">
                  {row.isEdge ? (
                    <div className="flex items-center justify-end gap-2">
                      <input 
                        type="text"
                        inputMode="decimal"
                        value={edgePrices[row.priceKey || row.key!] || ''}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = e.target.value.replace(',', '.');
                          if (v === '' || /^\d*\.?\d*$/.test(v)) {
                            setEdgePrices(prev => ({ ...prev, [row.priceKey || row.key!]: v === '' ? 0 : parseFloat(v) }));
                          }
                        }}
                        placeholder="0"
                        disabled={!canEditCabinet}
                        className={cn(
                          "w-20 p-1 border rounded text-right text-sm outline-none text-gray-900",
                          !canEditCabinet ? "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed" : "border-gray-200 focus:ring-1 focus:ring-blue-500"
                        )}
                      />
                      <span>₽</span>
                    </div>
                  ) : row.type === 'material' && row.isManual ? (
                    <div className="flex items-center justify-end gap-2">
                      <input 
                        type="text"
                        inputMode="decimal"
                        value={prices[row.priceKey!] || ''}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = e.target.value.replace(',', '.');
                          if (v === '' || /^\d*\.?\d*$/.test(v)) {
                            setPrices(prev => ({ ...prev, [row.priceKey!]: v === '' ? 0 : parseFloat(v) }));
                          }
                        }}
                        placeholder="0"
                        className="w-20 p-1 border border-blue-200 rounded text-right text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-blue-50/50"
                      />
                      <span>₽</span>
                    </div>
                  ) : (
                    `${(row.price ?? 0).toLocaleString()} ₽`
                  )}
                </td>
                <td className="px-6 py-2 text-right font-bold text-gray-900">
                  <span className={cn(row.isEdge && "text-sm font-medium text-gray-600")}>
                    {(row.total ?? 0).toLocaleString()} ₽
                  </span>
                </td>
              </tr>
              );
            })}
            
            {summaryRows.some(r => r.type === 'product') && (
              <>
                <tr className="bg-gray-50/50">
                  <td colSpan={5} className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Дополнительная фурнитура и аксессуары
                  </td>
                </tr>
                {summaryRows.filter(r => r.type === 'product').map((row, idx) => (
                  <tr key={`prod-${idx}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-2">
                      <div className="font-medium text-gray-900">{row.name}</div>
                      <div className="text-xs text-gray-500">{row.sub}</div>
                    </td>
                    <td className="px-6 py-2">
                      <span className="text-sm font-medium text-gray-400">-</span>
                    </td>
                    <td className="px-6 py-2 text-right text-sm font-medium">{row.qty}</td>
                    <td className="px-6 py-2 text-right text-sm font-medium">
                      {(row.price ?? 0).toLocaleString()} ₽
                    </td>
                    <td className="px-6 py-2 text-right font-bold text-gray-900">{(row.total ?? 0).toLocaleString()} ₽</td>
                  </tr>
                ))}
              </>
            )}
            {summaryRows.some(r => r.type === 'service') && (
              <>
                <tr className="bg-gray-50/50">
                  <td colSpan={5} className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Услуги и сервис
                  </td>
                </tr>
                {summaryRows.filter(r => r.type === 'service').map((row, idx) => (
                  <tr key={`serv-${idx}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-2">
                      <div className="font-medium text-gray-900">{row.name}</div>
                      <div className="text-xs text-gray-500">{row.sub}</div>
                    </td>
                    <td className="px-6 py-2">
                      <span className="text-sm font-medium text-gray-400">-</span>
                    </td>
                    <td className="px-6 py-2 text-right text-sm font-medium text-green-600">{row.qty}</td>
                    <td className="px-6 py-2 text-right text-sm font-medium text-green-600">
                      {row.isManual ? (
                        <div className="flex items-center justify-end gap-2">
                          <input 
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={prices[row.name] || ''}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || /^\d*$/.test(val)) {
                                setPrices(prev => ({ ...prev, [row.name]: val === '' ? 0 : parseInt(val) }));
                              }
                            }}
                            placeholder="0"
                            className="w-20 p-1 border border-blue-200 rounded text-right text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-blue-50/50"
                          />
                          <span>₽</span>
                        </div>
                      ) : (
                        `${(row.price ?? 0).toLocaleString()} ₽`
                      )}
                    </td>
                    <td className="px-6 py-2 text-right font-bold text-green-600">{(row.total ?? 0).toLocaleString()} ₽</td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-blue-50">
              <td colSpan={3} className="px-6 py-4 text-right font-bold text-gray-700 text-lg">Общая стоимость:</td>
              <td colSpan={2} className="px-6 py-4 text-right font-black text-blue-600 text-2xl">
                {finalTotal > 0 ? `${(finalTotal ?? 0).toLocaleString()} ₽` : '0 ₽'}
                {!allDataEntered && <div className="text-[10px] text-gray-400 font-normal mt-1">Заполните все цены</div>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Service Info Summary */}
      {(serviceData.address.street || serviceData.delivery || serviceData.assembly) && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {serviceData.address.street && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-gray-800 font-bold">
                <MapPin className="w-5 h-5 text-blue-600" />
                Адрес доставки
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p><span className="font-medium">Улица:</span> {serviceData.address.street}</p>
                <div className="flex gap-4">
                  <p><span className="font-medium">Дом:</span> {serviceData.address.house}</p>
                  <p><span className="font-medium">Кв:</span> {serviceData.address.apartment}</p>
                </div>
                <div className="flex gap-4">
                  <p><span className="font-medium">Этаж:</span> {serviceData.address.floor}</p>
                  <p><span className="font-medium">Лифт:</span> {
                    serviceData.address.elevator === 'passenger' ? 'Пассажирский' :
                    serviceData.address.elevator === 'cargo' ? 'Грузовой' : 'Отсутствует'
                  }</p>
                </div>
              </div>
            </div>
          )}
          
          {(serviceData.delivery || serviceData.assembly) && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-gray-800 font-bold">
                <Settings className="w-5 h-5 text-blue-600" />
                Дополнительные услуги
              </div>
              <div className="space-y-3">
                {serviceData.delivery && (
                  <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                    <Truck className="w-4 h-4" />
                    Доставка заказа на объект
                  </div>
                )}
                {serviceData.assembly && (
                  <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                    <Wrench className="w-4 h-4" />
                    Базовый пакет сборки и монтажа (12%)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SettingsView = ({ 
  coefficients, 
  setCoefficients, 
  calcMode, 
  setCalcMode, 
  trimming, 
  setTrimming, 
  defaultCuttingType, 
  setDefaultCuttingType,
  hardwareKitPrice,
  setHardwareKitPrice,
  assemblyPercentage,
  setAssemblyPercentage,
  deliveryTariffs,
  setDeliveryTariffs,
  mapLink,
  setMapLink,
  canEditCabinet,
  canEditFacades,
  canEditHardware,
  canEditAssembly,
  canEditDelivery,
  productCategories,
  setProductCategories,
  productionFormat,
  productionSettings,
  companyType,
  onSaveSettings,
  salonsUsingMe,
  salonsInTable,
  toggleSpecialCondition,
  updateStandardCoefficient,
  updateSalonCoefficient,
  ownProductionConfig,
  companyInfo,
  setCompanyInfo
}: { 
  coefficients: { retail: any, wholesale: any, designer: any }; 
  setCoefficients: React.Dispatch<React.SetStateAction<{ retail: any, wholesale: any, designer: any }>>; 
  calcMode: 'sheet' | 'area'; 
  setCalcMode: React.Dispatch<React.SetStateAction<'sheet' | 'area'>>; 
  trimming: number; 
  setTrimming: React.Dispatch<React.SetStateAction<number>>; 
  defaultCuttingType: 'saw' | 'nesting'; 
  setDefaultCuttingType: React.Dispatch<React.SetStateAction<'saw' | 'nesting'>>; 
  hardwareKitPrice: { retail: number, wholesale: number, designer?: number };
  setHardwareKitPrice: React.Dispatch<React.SetStateAction<{ retail: number, wholesale: number, designer?: number }>>;
  assemblyPercentage: number;
  setAssemblyPercentage: React.Dispatch<React.SetStateAction<number>>;
  deliveryTariffs: DeliveryTariffs;
  setDeliveryTariffs: React.Dispatch<React.SetStateAction<DeliveryTariffs>>;
  mapLink: string;
  setMapLink: React.Dispatch<React.SetStateAction<string>>;
  canEditCabinet: boolean;
  canEditFacades: boolean;
  canEditHardware: boolean;
  canEditAssembly: boolean;
  canEditDelivery: boolean;
  productCategories: string[];
  setProductCategories: React.Dispatch<React.SetStateAction<string[]>>;
  productionFormat: string;
  productionSettings: any;
  companyType?: string;
  onSaveSettings: () => void;
  salonsUsingMe: any[];
  salonsInTable: any[];
  toggleSpecialCondition: (id: string) => void;
  updateStandardCoefficient: (cat: string, val: string) => void;
  updateSalonCoefficient: (salonId: string, cat: string, val: string) => void;
  ownProductionConfig: OwnProductionConfig;
  companyInfo: any;
  setCompanyInfo: React.Dispatch<React.SetStateAction<any>>;
}) => {
  const [newCategory, setNewCategory] = useState('');

  const isContract = productionFormat === 'contract';
  const isProduction = companyType === 'Мебельное производство';
  const prodGen = productionSettings?.general;
  const prodCoeffs = prodGen?.coefficients?.wholesale || {};
  const prodHardware = prodGen?.hardwareKitPrice?.wholesale || prodGen?.hardwareKitPrice || 0;

  const handleAddCategory = () => {
    if (newCategory && !productCategories.includes(newCategory)) {
      setProductCategories(prev => [...prev, newCategory]);
      setCoefficients(prev => ({
        ...prev,
        retail: {
          ...prev.retail,
          products: {
            ...prev.retail.products,
            [newCategory]: 1.5
          }
        },
        wholesale: {
          ...prev.wholesale,
          products: {
            ...prev.wholesale.products,
            [newCategory]: 1.2
          }
        },
        designer: {
          ...prev.designer,
          products: {
            ...prev.designer.products,
            [newCategory]: 1.3
          }
        }
      }));
      setNewCategory('');
    }
  };

  const handleRemoveCategory = (cat: string) => {
    setProductCategories(prev => prev.filter(c => c !== cat));
  };

  const updateCoeff = (type: 'retail' | 'wholesale' | 'designer', id: string, value: number) => {
    setCoefficients(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [id]: value
      }
    }));
  };

  const updateProductCoeff = (type: 'retail' | 'wholesale' | 'designer', cat: string, value: number) => {
    setCoefficients(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        products: {
          ...prev[type].products,
          [cat]: value
        }
      }
    }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-12">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-8">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Общие настройки</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="font-bold text-gray-700 block">Метод расчета стоимости</span>
                <span className="text-xs text-gray-500">Считать цену за целый лист или за м²</span>
              </div>
              <div className="flex gap-2 p-1 bg-gray-200 rounded-lg">
                <button 
                  onClick={() => setCalcMode('area')}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                    calcMode === 'area' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  За м²
                </button>
                <button 
                  onClick={() => setCalcMode('sheet')}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                    calcMode === 'sheet' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  За лист
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="font-bold text-gray-700 block">Тип раскроя по умолчанию</span>
                <span className="text-xs text-gray-500">Будет выбран при запуске</span>
              </div>
              <div className="flex gap-2 p-1 bg-gray-200 rounded-lg">
                <button 
                  onClick={() => !isContract && setDefaultCuttingType('saw')}
                  disabled={isContract}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                    defaultCuttingType === 'saw' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700",
                    isContract && "cursor-not-allowed opacity-80"
                  )}
                >
                  Пила
                </button>
                <button 
                  onClick={() => !isContract && setDefaultCuttingType('nesting')}
                  disabled={isContract}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                    defaultCuttingType === 'nesting' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700",
                    isContract && "cursor-not-allowed opacity-80"
                  )}
                >
                  Нестинг
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="font-bold text-gray-700 block">Обпил листа (мм)</span>
                <span className="text-xs text-gray-500">Отступ от краев листа</span>
              </div>
              <input 
                type="number" 
                value={trimming}
                onChange={(e) => !isContract && setTrimming(parseFloat(e.target.value) || 0)}
                disabled={isContract}
                className={cn(
                  "w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none",
                  isContract && "bg-gray-100 text-gray-500 cursor-not-allowed"
                )}
              />
            </div>
          </div>
        </section>

        {!isProduction && (
          <section>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Дополнительно</h3>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="font-bold text-gray-700 block">Цена комплекта метизов</span>
                    <span className="text-xs text-gray-500">На 1 лист ЛДСП</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <>
                    {isContract && prodHardware !== undefined && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-blue-600 uppercase font-bold">От производства (₽)</label>
                        <div className="p-2 bg-blue-50 text-blue-700 font-bold rounded-lg text-right border border-blue-100">
                          {prodHardware}
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-400 uppercase font-bold">Моя розница (₽)</label>
                      <input 
                        type="number" 
                        value={hardwareKitPrice.retail}
                        onChange={(e) => setHardwareKitPrice(prev => ({ ...prev, retail: parseFloat(e.target.value) || 0 }))}
                        className="w-full p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </>
                </div>
              </div>
            </div>
          </section>
        )}

        {!isProduction && (
          <section>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Коэффициенты наценки</h3>
            <div className="grid gap-4">
              {[
                { id: 'ldsp', label: 'ЛДСП / МДФ', sub: 'На листы' },
                { id: 'hdf', label: 'ДВП / ХДФ', sub: 'На листы' },
                { id: 'edge', label: 'Кромка', sub: 'На метраж' },
                { id: 'facadeSheet', label: 'Фасады плитные', sub: 'На листы' },
                { id: 'facadeCustom', label: 'Фасады заказные', sub: 'На м²' },
                { id: 'hardware', label: 'Фурнитура', sub: 'На комплектующие' }
              ].map(item => (
                <div key={item.id} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-bold text-gray-700 block">{item.label}</span>
                      <span className="text-[10px] text-gray-400 uppercase">{item.sub}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <>
                      {isContract && prodCoeffs[item.id] !== undefined && (
                        <div className="space-y-1">
                          <label className="text-[10px] text-blue-600 uppercase font-bold">От производства</label>
                          <div className="p-2 bg-blue-50 text-blue-700 font-bold rounded-lg text-right border border-blue-100">
                            {prodCoeffs[item.id]}
                          </div>
                        </div>
                      )}
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase font-bold">Моя розница (x)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={coefficients.retail[item.id]}
                          onChange={(e) => updateCoeff('retail', item.id, parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase font-bold">Опт (x)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={coefficients.wholesale[item.id]}
                          onChange={(e) => updateCoeff('wholesale', item.id, parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 uppercase font-bold">Дизайнер (x)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={coefficients.designer[item.id]}
                          onChange={(e) => updateCoeff('designer', item.id, parseFloat(e.target.value) || 0)}
                          className="w-full p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Категории товаров и коэффициенты</h3>
          <p className="text-sm text-gray-500 mb-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
            Добавьте категорию товара, если она будет иметь иной коэфициент, отличающийся от общей фурнитуры. Коэффиценты можно настроить в таблице ниже.
          </p>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Новая категория..."
                className="flex-1 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                onClick={handleAddCategory}
                disabled={!newCategory}
                className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Добавить
              </button>
            </div>
            {!isProduction && (
              <div className="grid gap-4">
                {productCategories.map(cat => (
                  <div key={cat} className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRemoveCategory(cat)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          title="Удалить категорию"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <span className="font-bold text-gray-700 block">{cat}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <>
                        {isContract && productionSettings?.categories?.coefficients?.[cat] !== undefined && (
                          <div className="space-y-1">
                            <label className="text-[10px] text-blue-600 uppercase font-bold">От производства</label>
                            <div className="p-2 bg-blue-50 text-blue-700 font-bold rounded-lg text-right border border-blue-100">
                              {productionSettings.categories.coefficients[cat]}
                            </div>
                          </div>
                        )}
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-bold">Моя розница (x)</label>
                          <input 
                            type="number" 
                            step="0.1"
                            value={coefficients.retail.products?.[cat] || 1.5}
                            onChange={(e) => updateProductCoeff('retail', cat, parseFloat(e.target.value) || 0)}
                            className="w-full p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-bold">Опт (x)</label>
                          <input 
                            type="number" 
                            step="0.1"
                            value={coefficients.wholesale.products?.[cat] || 1.2}
                            onChange={(e) => updateProductCoeff('wholesale', cat, parseFloat(e.target.value) || 0)}
                            className="w-full p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-bold">Дизайнер (x)</label>
                          <input 
                            type="number" 
                            step="0.1"
                            value={coefficients.designer.products?.[cat] || 1.3}
                            onChange={(e) => updateProductCoeff('designer', cat, parseFloat(e.target.value) || 0)}
                            className="w-full p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        
        {!isProduction && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Assembly & Delivery Section */}
            <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Truck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 leading-none">Сборка и доставка</h3>
                  <p className="text-xs text-gray-400 font-medium mt-1">Настройка тарифов на услуги сервиса</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Delivery & Loading */}
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Тарифы на доставку</label>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-gray-600 block ml-1">Минимальная (₽)</span>
                        <input 
                          type="number"
                          value={deliveryTariffs.basePrice}
                          onChange={(e) => setDeliveryTariffs(prev => ({ ...prev, basePrice: parseInt(e.target.value) || 0 }))}
                          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-gray-600 block ml-1">Бесплатно (км)</span>
                        <input 
                          type="number"
                          value={deliveryTariffs.baseDistance}
                          onChange={(e) => setDeliveryTariffs(prev => ({ ...prev, baseDistance: parseInt(e.target.value) || 0 }))}
                          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-gray-600 block ml-1">Цена за км (₽/км)</span>
                        <input 
                          type="number"
                          value={deliveryTariffs.extraKmPrice}
                          onChange={(e) => setDeliveryTariffs(prev => ({ ...prev, extraKmPrice: parseInt(e.target.value) || 0 }))}
                          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-gray-600 block ml-1">Доп. грузчик (₽)</span>
                        <input 
                          type="number"
                          value={deliveryTariffs.extraLoaderPrice}
                          onChange={(e) => setDeliveryTariffs(prev => ({ ...prev, extraLoaderPrice: parseInt(e.target.value) || 0 }))}
                          className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-4">
                    <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest">Разгрузка и подъем</label>
                    
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-bold text-blue-800">Базовый подъем (₽)</span>
                        <input 
                          type="number"
                          value={deliveryTariffs.loadingBase}
                          onChange={(e) => setDeliveryTariffs(prev => ({ ...prev, loadingBase: parseInt(e.target.value) || 0 }))}
                          className="w-24 px-3 py-1.5 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-right"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-bold text-blue-800">Этаж без лифта (₽/эт)</span>
                        <input 
                          type="number"
                          value={deliveryTariffs.floorPrice}
                          onChange={(e) => setDeliveryTariffs(prev => ({ ...prev, floorPrice: parseInt(e.target.value) || 0 }))}
                          className="w-24 px-3 py-1.5 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-right"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-bold text-blue-800">С лифтом (фикс ₽)</span>
                        <input 
                          type="number"
                          value={deliveryTariffs.elevatorPrice}
                          onChange={(e) => setDeliveryTariffs(prev => ({ ...prev, elevatorPrice: parseInt(e.target.value) || 0 }))}
                          className="w-24 px-3 py-1.5 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-right"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assembly & Hardware */}
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Сборка и метизы</label>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-gray-700">Процент на сборку</span>
                          <span className="text-lg font-black text-blue-600">{assemblyPercentage}%</span>
                        </div>
                        <input 
                          type="range"
                          min="0"
                          max="30"
                          step="1"
                          value={assemblyPercentage}
                          onChange={(e) => setAssemblyPercentage(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>

                      <div className="pt-4 border-t border-gray-200">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-3">Комплект метизов (на лист)</span>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-500 block ml-1 uppercase">Розница (₽)</span>
                            <input 
                              type="number"
                              value={hardwareKitPrice.retail}
                              onChange={(e) => setHardwareKitPrice(prev => ({ ...prev, retail: parseInt(e.target.value) || 0 }))}
                              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-500 block ml-1 uppercase">Дизайнер (₽)</span>
                            <input 
                              type="number"
                              value={hardwareKitPrice.designer || 0}
                              onChange={(e) => setHardwareKitPrice(prev => ({ ...prev, designer: parseInt(e.target.value) || 0 }))}
                              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <span className="font-bold text-gray-700 block text-sm">Ссылка на карты</span>
                      <span className="text-[10px] text-gray-400">Для расчета логистики в сервисе</span>
                    </div>
                    <input 
                      type="text" 
                      value={mapLink}
                      onChange={(e) => setMapLink(e.target.value)}
                      className="w-48 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none truncate"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
        {isProduction && (
          <div className="pt-8 border-t border-gray-100 font-sans space-y-8">
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Подключенные клиенты</h3>
              </div>
              <p className="text-xs text-gray-500 mb-6">Список салонов и дизайнеров, работающих с вами. Включите «Спец условия», чтобы задать индивидуальные коэффициенты.</p>
              
              {salonsUsingMe.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {salonsUsingMe.map(salon => {
                    const isSpecial = ownProductionConfig.specialConditionIds?.includes(salon.id);
                    return (
                      <div key={salon.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col justify-between gap-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-gray-800">{salon.name}</div>
                            <div className="text-[10px] text-gray-400 uppercase font-medium">{salon.city} | {salon.type}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleSpecialCondition(salon.id)}
                          className={cn(
                            "w-full py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                            isSpecial 
                              ? "bg-blue-600 text-white shadow-md shadow-blue-100" 
                              : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600"
                          )}
                        >
                          {isSpecial ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4" />}
                          Спец условия {isSpecial ? 'активны' : 'не активны'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 text-center">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Нет подключенных клиентов</p>
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Коэффициенты и клиенты</h3>
              </div>
              <p className="text-xs text-gray-500 mb-6 font-medium">В этой таблице вы управляете всеми наценками: для розничных клиентов, дизайнеров и ваших салонов-партнеров.</p>
              
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-left border-collapse bg-white">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50">Категория</th>
                      
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-l border-gray-100 min-w-[100px]">
                        Розница
                      </th>
                      
                      <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-l border-gray-100 min-w-[100px]">
                        Дизайнеры
                      </th>

                      <th className="py-3 px-4 text-[10px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50/50 min-w-[120px] border-l border-blue-100">
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          <span>Салоны (Стандарт)</span>
                        </div>
                      </th>
                      
                      {salonsInTable.map(salon => (
                        <th key={salon.id} className="py-3 px-4 text-[10px] font-bold text-gray-800 uppercase tracking-wider bg-gray-50 min-w-[120px] border-l border-gray-100">
                          {salon.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { id: 'ldsp', label: 'ЛДСП / МДФ', baseId: 'ldsp' },
                      { id: 'hdf', label: 'ДВП / ХДФ', baseId: 'hdf' },
                      { id: 'edge', label: 'Кромка', baseId: 'edge' },
                      { id: 'facadeSheet', label: 'Фасад (плита)', baseId: 'facadeSheet' },
                      { id: 'facadeCustom', label: 'Фасад (заказной)', baseId: 'facadeCustom' },
                      { id: 'hardware', label: 'Фурнитура', baseId: 'hardware' },
                      ...productCategories.map(cat => ({ id: `cat_${cat}`, label: cat, isProduct: true, catName: cat }))
                    ].map((row: any, idx) => (
                      <tr key={row.id} className={cn(
                        "border-b border-gray-50 transition-colors",
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/10"
                      )}>
                        <td className="py-2 px-4 text-[11px] font-semibold text-gray-600">
                          <div className="flex items-center gap-2">
                            {row.isProduct && (
                              <button
                                onClick={() => handleRemoveCategory(row.catName!)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                            {row.label}
                          </div>
                        </td>

                        {/* Retail column */}
                        <td className="py-1.5 px-4 border-l border-gray-50">
                          <input 
                            type="number"
                            step="0.01"
                            value={
                              row.isProduct ? (coefficients.retail.products?.[row.catName!] || 1.5) : 
                              (coefficients.retail[row.baseId!] || 1.5)
                            }
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              if (row.isProduct) updateProductCoeff('retail', row.catName!, v);
                              else updateCoeff('retail', row.baseId!, v);
                            }}
                            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none text-right"
                          />
                        </td>

                        {/* Designer column */}
                        <td className="py-1.5 px-4 border-l border-gray-50">
                          <input 
                            type="number"
                            step="0.01"
                            value={
                              row.isProduct ? (coefficients.designer.products?.[row.catName!] || 1.5) : 
                              (coefficients.designer[row.baseId!] || 1.5)
                            }
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0;
                              if (row.isProduct) updateProductCoeff('designer', row.catName!, v);
                              else updateCoeff('designer', row.baseId!, v);
                            }}
                            className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none text-right"
                          />
                        </td>
                        
                        {/* Standard/Wholesale column */}
                        <td className="py-1.5 px-4 border-l border-blue-50 bg-blue-50/5">
                          <div className="relative">
                            <input 
                              type="number"
                              step="0.01"
                              value={
                                ((ownProductionConfig as any).standardCoefficients?.[row.id] ?? 1.5)
                              }
                              onChange={(e) => {
                                const v = e.target.value;
                                updateStandardCoefficient(row.id, v);
                              }}
                              className="w-full px-2 py-1 border border-blue-100 rounded-lg text-xs font-bold bg-white focus:ring-1 focus:ring-blue-500 outline-none text-right"
                            />
                          </div>
                        </td>

                        {salonsInTable.map(salon => (
                          <td key={salon.id} className="py-1.5 px-4 border-l border-gray-50">
                            <input 
                              type="number"
                              step="0.01"
                              value={
                                (ownProductionConfig.salonCoefficients?.[salon.id]?.[row.id] ?? (ownProductionConfig.standardCoefficients?.[row.id] ?? 1.5))
                              }
                              onChange={(e) => {
                                const v = e.target.value;
                                updateSalonCoefficient(salon.id, row.id, v);
                              }}
                              className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none text-right"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* Company Info Section */}
        <section className="pt-8 border-t border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Данные компании</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-4 lg:col-span-1">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Основная информация</label>
                <div className="space-y-3">
                    <input 
                    type="text"
                    placeholder="Наименование компании"
                    value={companyInfo.name}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 placeholder:text-gray-300 transition-all text-sm"
                  />
                  
                  <textarea 
                    placeholder="Юридический адрес"
                    value={companyInfo.legalAddress || ''}
                    rows={3}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, legalAddress: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 text-sm placeholder:text-gray-300 resize-none"
                  />
                  
                  <input 
                    type="tel"
                    placeholder="+7 (___) ___-__-__"
                    value={companyInfo.phone || ''}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, phone: formatPhoneNumber(e.target.value) })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 text-sm placeholder:text-gray-300"
                  />
                  
                  <div className="flex gap-2">
                    {['ИП', 'ООО'].map(form => (
                      <button
                        key={form}
                        onClick={() => setCompanyInfo({ ...companyInfo, legalForm: form })}
                        className={cn(
                          "flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all border uppercase tracking-widest",
                          companyInfo.legalForm === form 
                            ? "bg-gray-900 text-white border-gray-900 shadow-lg shadow-gray-200" 
                            : "bg-white text-gray-400 border-gray-100 hover:border-gray-200"
                        )}
                      >
                        {form}
                      </button>
                    ))}
                  </div>

                  {companyInfo.legalForm === 'ООО' && (
                    <input 
                      type="text"
                      placeholder="Генеральный директор"
                      value={companyInfo.director}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, director: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  )}

                  <div className="grid grid-cols-1 gap-3">
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300 uppercase">ИНН</span>
                      <input 
                        type="text"
                        value={companyInfo.inn}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, inn: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                      />
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300 uppercase">
                        {companyInfo.legalForm === 'ИП' ? 'ОГРНИП' : 'ОГРН'}
                      </span>
                      <input 
                        type="text"
                        value={companyInfo.ogrn}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, ogrn: e.target.value })}
                        className="w-full pl-20 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 lg:col-span-1">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Налогообложение</label>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <span className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Система</span>
                      <select
                        value={companyInfo.taxSystem}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, taxSystem: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-bold"
                      >
                        <option value="ОСНО">ОСНО (НДС 20%)</option>
                        <option value="УСН Доходы">УСН Доходы</option>
                        <option value="УСН Доходы-расходы">УСН Доходы-расходы</option>
                        <option value="Патент">Патент</option>
                        <option value="НПД">НПД (Самозанятый)</option>
                      </select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Ставка %</span>
                        <input 
                          type="number"
                          value={companyInfo.taxRate}
                          onChange={(e) => setCompanyInfo({ ...companyInfo, taxRate: parseFloat(e.target.value) || 0 })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                        />
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">НДС %</span>
                        <select
                          value={companyInfo.vat}
                          onChange={(e) => setCompanyInfo({ ...companyInfo, vat: parseInt(e.target.value) })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-bold"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="7">7%</option>
                          <option value="20">20%</option>
                          <option value="22">22%</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Контакты</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <input 
                        type="text"
                        placeholder="Сайт"
                        value={companyInfo.website}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, website: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 bg-transparent border-b border-gray-200 focus:border-blue-500 outline-none text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <input 
                        type="text"
                        placeholder="VK"
                        value={companyInfo.socials?.vk}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, socials: { ...companyInfo.socials, vk: e.target.value } })}
                        className="w-full px-2 py-2 bg-transparent border-b border-gray-200 focus:border-blue-500 outline-none text-xs"
                      />
                      <input 
                        type="text"
                        placeholder="Telegram"
                        value={companyInfo.socials?.telegram}
                        onChange={(e) => setCompanyInfo({ ...companyInfo, socials: { ...companyInfo.socials, telegram: e.target.value } })}
                        className="w-full px-2 py-2 bg-transparent border-b border-gray-200 focus:border-blue-500 outline-none text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 lg:col-span-1">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Банковские реквизиты</label>
                <div className="space-y-3">
                  <input 
                    type="text"
                    placeholder="Наименование банка"
                    value={companyInfo.bankName}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, bankName: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm placeholder:text-gray-300"
                  />
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-gray-300">БИК</span>
                    <input 
                      type="text"
                      value={companyInfo.bik}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, bik: e.target.value })}
                      className="w-full pl-12 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-gray-300 uppercase">Р/С</span>
                    <input 
                      type="text"
                      placeholder="Расчетный счет"
                      value={companyInfo.rs}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, rs: e.target.value })}
                      className="w-full pl-12 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-gray-300 uppercase">К/С</span>
                    <input 
                      type="text"
                      placeholder="Корр. счет"
                      value={companyInfo.ks}
                      onChange={(e) => setCompanyInfo({ ...companyInfo, ks: e.target.value })}
                      className="w-full pl-12 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="pt-6 border-t border-gray-100 flex justify-end">
          <button
            onClick={onSaveSettings}
            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            Сохранить настройки
          </button>
        </div>

        <div className="pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400 leading-relaxed italic">
            * Коэффициенты применяются к базовой цене материала в итоговом расчете. 
            Например, если цена листа 1000₽ и коэффициент 4, итоговая цена за лист будет 4000₽.
          </p>
        </div>
      </div>
    </div>
  );
};



const SAMPLE_PRODUCTS = [
  { id: 1, name: "Петля Sensys 8645i", category: "Петли", price: 250, description: "Петля со встроенным демпфером Silent System", image: "" },
  { id: 2, name: "Ручка-скоба 128мм", category: "Ручки и крючки", price: 450, description: "Матовый черный металл, современный стиль", image: "" },
  { id: 3, name: "Тандембокс Antaro", category: "Системы выдвижения", price: 3500, description: "Система выдвижения с доводчиком, высота M", image: "" },
  { id: 4, name: "Мойка GranFest Quarz", category: "Мойки и аксессуары", price: 8900, description: "Кварцевая мойка, цвет Песок", image: "" },
];

const ServiceItem = ({ service, defaultPrice, onAdd }: { service: any, defaultPrice: number, onAdd: (service: any, qty: number, price: number) => void }) => {
  const [qty, setQty] = useState(1);
  const [customPrice, setCustomPrice] = useState<string | number>(defaultPrice > 0 ? defaultPrice : '');

  const currentPrice = typeof customPrice === 'number' ? customPrice : (parseFloat(customPrice) || 0);

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex-1">
        <h3 className="font-bold text-gray-800">{service.name}</h3>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-sm text-gray-500">Ед. изм: {service.unit}</span>
          <div className="flex items-center gap-2">
            <input 
              type="number"
              placeholder="Цена"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              className="w-24 px-3 py-1 border border-gray-200 rounded-lg text-sm font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <span className="text-sm font-bold text-gray-500">₽</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
          <button 
            onClick={() => setQty(Math.max(1, qty - 1))}
            className="p-2 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <input 
            type="number" 
            value={qty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 text-center bg-transparent font-bold text-gray-800 outline-none"
          />
          <button 
            onClick={() => setQty(qty + 1)}
            className="p-2 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <button 
          onClick={() => onAdd({ ...service, price: currentPrice }, qty, currentPrice)}
          disabled={currentPrice <= 0}
          className={cn(
            "px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2",
            currentPrice > 0 ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md" : "bg-gray-100 text-gray-400 cursor-not-allowed"
          )}
        >
          <Plus className="w-4 h-4" />
          Добавить
        </button>
      </div>
    </div>
  );
};

const ServicesView = ({ 
  onAddService, 
  prices,
  catalogServices,
  setCatalogServices
}: { 
  onAddService: (service: any, qty: number) => void;
  prices: Record<string, number>;
  catalogServices: any[];
  setCatalogServices: React.Dispatch<React.SetStateAction<any[]>>;
}) => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customDeliverySupplier, setCustomDeliverySupplier] = useState('');
  const [customDeliveryPrice, setCustomDeliveryPrice] = useState(0);
  const [newService, setNewService] = useState({ name: '', unit: 'шт', price: 0 });

  const handleAddCustomDelivery = () => {
    onAddService({
      id: `custom-delivery-${Date.now()}`,
      name: 'Доставка от поставщика',
      unit: 'усл',
      supplier: customDeliverySupplier,
      price: customDeliveryPrice
    }, quantities['custom-delivery'] || 1);
    setCustomDeliverySupplier('');
    setCustomDeliveryPrice(0);
    setQuantities(prev => ({ ...prev, 'custom-delivery': 1 }));
  };

  const handleCreateService = () => {
    if (!newService.name || newService.price <= 0) return;
    const service = {
      id: `custom-${Date.now()}`,
      name: newService.name,
      unit: newService.unit,
      price: newService.price
    };
    setCatalogServices(prev => [...prev, service]);
    setNewService({ name: '', unit: 'шт', price: 0 });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Услуги производства</h2>
        <p className="text-sm text-gray-500">Выберите необходимые услуги (цену можно скорректировать перед добавлением)</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-8">
        <h3 className="font-bold text-gray-800 mb-4">Создать новую услугу</h3>
        <div className="flex flex-col md:flex-row gap-4">
          <input 
            type="text" 
            placeholder="Название услуги"
            value={newService.name}
            onChange={e => setNewService(prev => ({ ...prev, name: e.target.value }))}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input 
            type="text" 
            placeholder="Ед. изм. (шт, м, м2)"
            value={newService.unit}
            onChange={e => setNewService(prev => ({ ...prev, unit: e.target.value }))}
            className="w-32 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              placeholder="Цена"
              value={newService.price || ''}
              onChange={e => setNewService(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
              className="w-24 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <span className="font-bold text-gray-500">₽</span>
          </div>
          <button 
            onClick={handleCreateService}
            disabled={!newService.name || newService.price <= 0}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
          >
            Добавить
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {catalogServices.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            Каталог пуст
          </div>
        ) : (
          catalogServices.map(service => {
            const defaultPrice = service.price !== undefined ? service.price : (prices[service.name] || 0);
            return (
              <ServiceItem 
                key={service.id} 
                service={service} 
                defaultPrice={defaultPrice} 
                onAdd={onAddService} 
              />
            );
          })
        )}
        
        {/* Custom Delivery Service */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 space-y-3">
            <h3 className="font-bold text-gray-800">Доставка от поставщика</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                type="text" 
                placeholder="Укажите поставщика"
                value={customDeliverySupplier}
                onChange={(e) => setCustomDeliverySupplier(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  placeholder="Цена"
                  value={customDeliveryPrice || ''}
                  onChange={(e) => setCustomDeliveryPrice(parseFloat(e.target.value) || 0)}
                  className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="text-sm font-bold text-gray-500">₽</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              <button 
                onClick={() => setQuantities(prev => ({ ...prev, 'custom-delivery': Math.max(1, (prev['custom-delivery'] || 1) - 1) }))}
                className="p-2 hover:bg-gray-200 text-gray-600 transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input 
                type="number" 
                value={quantities['custom-delivery'] || 1}
                onChange={(e) => setQuantities(prev => ({ ...prev, 'custom-delivery': parseInt(e.target.value) || 1 }))}
                className="w-16 text-center bg-transparent font-bold text-gray-800 outline-none"
              />
              <button 
                onClick={() => setQuantities(prev => ({ ...prev, 'custom-delivery': (prev['custom-delivery'] || 1) + 1 }))}
                className="p-2 hover:bg-gray-200 text-gray-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <button 
              onClick={handleAddCustomDelivery}
              disabled={!customDeliverySupplier || customDeliveryPrice <= 0}
              className={cn(
                "px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2",
                !customDeliverySupplier || customDeliveryPrice <= 0
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
              )}
            >
              <Plus className="w-4 h-4" />
              Добавить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ServiceSectionView = ({ 
  data, 
  setData, 
  mapLink, 
  productionSettings, 
  productionFormat,
  totalCost,
  assemblyPercentage,
  deliveryTariffs,
  totalLdspSheets
}: { 
  data: any, 
  setData: (data: any) => void, 
  mapLink: string, 
  productionSettings?: any, 
  productionFormat: string,
  totalCost: number,
  assemblyPercentage: number,
  deliveryTariffs: DeliveryTariffs,
  totalLdspSheets: number
}) => {
  const updateAddress = (field: string, value: string) => {
    setData({
      ...data,
      address: { ...data.address, [field]: value }
    });
  };

  const calculatedDeliveryPrice = useMemo(() => {
    if (!data.delivery) return 0;
    let fee = deliveryTariffs.basePrice;
    if (data.distance > deliveryTariffs.baseDistance) {
      fee += (data.distance - deliveryTariffs.baseDistance) * deliveryTariffs.extraKmPrice;
    }
    const totalVolume = totalLdspSheets * 0.1;
    if (totalVolume > deliveryTariffs.baseVolume) {
      fee += (totalVolume - deliveryTariffs.baseVolume) * deliveryTariffs.extraVolumePrice;
    }
    if (data.extraLoader) {
      fee += deliveryTariffs.extraLoaderPrice;
    }
    return Math.round(fee);
  }, [data.delivery, data.distance, data.extraLoader, deliveryTariffs, totalLdspSheets]);

  const calculatedAssemblyPrice = useMemo(() => {
    if (!data.assembly) return 0;
    return Math.round(totalCost * (assemblyPercentage / 100));
  }, [data.assembly, totalCost, assemblyPercentage]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Сервис и логистика</h2>
        <p className="text-sm text-gray-500">Укажите данные для доставки и монтажа</p>
      </div>

      {/* Address Section */}
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Адрес объекта</h3>
          </div>
          {mapLink && (
            <a 
              href={mapLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors flex items-center gap-2"
            >
              <MapPin className="w-4 h-4" />
              Рассчитать километраж
            </a>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Улица</label>
            <input 
              type="text" 
              value={data.address.street}
              onChange={(e) => updateAddress('street', e.target.value)}
              placeholder="Введите название улицы"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Дом</label>
            <input 
              type="text" 
              value={data.address.house}
              onChange={(e) => updateAddress('house', e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Квартира / Офис</label>
            <input 
              type="text" 
              value={data.address.apartment}
              onChange={(e) => updateAddress('apartment', e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Этаж</label>
            <input 
              type="text" 
              value={data.address.floor}
              onChange={(e) => updateAddress('floor', e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Наличие лифта</label>
            <select 
              value={data.address.elevator}
              onChange={(e) => updateAddress('elevator', e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
            >
              <option value="none">Отсутствует</option>
              <option value="passenger">Есть, пассажирский</option>
              <option value="cargo">Есть, грузовой</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Delivery Section */}
        <div className={cn(
          "p-8 rounded-3xl border transition-all",
          data.delivery ? "bg-blue-50 border-blue-200 shadow-md" : "bg-white border-gray-100 shadow-sm hover:border-blue-200"
        )}>
          <div className="flex items-center justify-between mb-6 cursor-pointer" onClick={() => setData({ ...data, delivery: !data.delivery })}>
            <div className={cn("p-3 rounded-2xl", data.delivery ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-400")}>
              <Truck className="w-6 h-6" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className={cn(
                "w-12 h-6 rounded-full relative transition-colors",
                data.delivery ? "bg-blue-600" : "bg-gray-200"
              )}>
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  data.delivery ? "left-7" : "left-1"
                )} />
              </div>
              {data.delivery && (
                <span className="text-sm font-black text-blue-600">{(calculatedDeliveryPrice ?? 0).toLocaleString()} ₽</span>
              )}
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2 cursor-pointer" onClick={() => setData({ ...data, delivery: !data.delivery })}>Доставка</h3>
          <p className="text-sm text-gray-500 mb-4 cursor-pointer" onClick={() => setData({ ...data, delivery: !data.delivery })}>Нужна ли услуга доставки на объект?</p>
          
          {data.delivery && (
            <div className="space-y-4 pt-4 border-t border-blue-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Расстояние от производства (км)</label>
                <input 
                  type="number" 
                  value={data.distance || ''}
                  onChange={(e) => setData({ ...data, distance: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Дополнительный грузчик</span>
                <div className={cn(
                  "w-10 h-5 rounded-full relative transition-colors cursor-pointer",
                  data.extraLoader ? "bg-blue-600" : "bg-gray-300"
                )} onClick={() => setData({ ...data, extraLoader: !data.extraLoader })}>
                  <div className={cn(
                    "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all",
                    data.extraLoader ? "left-5.5" : "left-0.5"
                  )} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Assembly Section */}
        <div className={cn(
          "p-8 rounded-3xl border transition-all cursor-pointer",
          data.assembly ? "bg-blue-50 border-blue-200 shadow-md" : "bg-white border-gray-100 shadow-sm hover:border-blue-200"
        )} onClick={() => setData({ ...data, assembly: !data.assembly })}>
          <div className="flex items-center justify-between mb-6">
            <div className={cn("p-3 rounded-2xl", data.assembly ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-400")}>
              <Wrench className="w-6 h-6" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className={cn(
                "w-12 h-6 rounded-full relative transition-colors",
                data.assembly ? "bg-blue-600" : "bg-gray-200"
              )}>
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                  data.assembly ? "left-7" : "left-1"
                )} />
              </div>
              {data.assembly && (
                <span className="text-sm font-black text-blue-600">{(calculatedAssemblyPrice ?? 0).toLocaleString()} ₽</span>
              )}
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Сборка и монтаж</h3>
          <p className="text-sm text-gray-500">Базовый пакет сборки (12% от стоимости)</p>
        </div>
      </div>

      {data.assembly && (
        <div className="mt-8 bg-blue-50/50 rounded-3xl p-8 border border-blue-100">
          <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Базовый пакет сборки включает:
          </h4>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            {[
              "Монтаж и сборка корпусов мебели",
              "Установка и монтаж к стене при необходимости",
              "Стяжка мебельных элементов между собой",
              "Распил и закрепление столешницы и стеновой панели",
              "Распил и закрепление плинтуса, цоколя",
              "Навеска и регулировка фасадов",
              "Установка ручек или систем Push to Open",
              "Пропилы под коммуникации для воды (один шкаф)"
            ].map((item, i) => (
              <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-blue-600 italic border-t border-blue-100 pt-4">
            Не перечисленные в "Базовый пакет сборки" работы оплачиваются отдельно на основании АКТ О ВЫПОЛНЕНИИ РАБОТ исходя из заказанных услуг при монтаже по дополнительному прайсу.
          </p>
        </div>
      )}
    </div>
  );
};
const ProductsView = ({ 
  onAddProduct, 
  catalogProducts,
  productCategories,
  setProductCategories,
  coefficients,
  productionFormat,
  onSaveProduct,
  onDeleteProduct,
  userRole,
  companyType,
  furnitureType,
  setFurnitureType,
  checklistRefused,
  setChecklistRefused,
  addedProducts
}: { 
  onAddProduct: (product: any, qty: number) => void;
  catalogProducts: any[];
  productCategories: string[];
  setProductCategories: React.Dispatch<React.SetStateAction<string[]>>;
  coefficients: any;
  productionFormat: string;
  onSaveProduct: (product: any) => void;
  onDeleteProduct: (id: string | number) => void;
  userRole?: string | null;
  companyType?: string;
  furnitureType?: string;
  setFurnitureType?: (t: string) => void;
  checklistRefused?: Record<string, boolean>;
  setChecklistRefused?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  addedProducts?: any[];
}) => {
  const [showChecklistWindow, setShowChecklistWindow] = useState(false);
  
  // Function to determine if an item is present
  const isItemPresent = (itemName: string) => {
    if (!addedProducts) return false;
    const lowerItemName = itemName.toLowerCase();
    // Simplified logic for ProductsView: just check if any added product name matches
    // Note: To be fully accurate, we might need more context, but this covers explicit products
    return addedProducts.some(p => {
      const prodName = (p.name || '').toLowerCase();
      return prodName.includes(lowerItemName);
    });
  };

  const currentChecklist = furnitureType && furnitureType in FURNITURE_CHECKLISTS ? FURNITURE_CHECKLISTS[furnitureType as FurnitureType] : null;

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  
  const [newProduct, setNewProduct] = useState({ 
    name: '', 
    category: productCategories[0], 
    purchasePrice: 0, 
    images: [] as string[],
    article: '',
    vendorArticle: '',
    manufacturerArticle: '',
    vat: 20,
    includeVat: true,
    color: '',
    description: '',
    unit: 'шт'
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setNewProduct(prev => ({ 
            ...prev, 
            images: [...prev.images, reader.result as string] 
          }));
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setNewProduct(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleAdd = (product: any) => {
    const qty = quantities[product.id] || 1;
    onAddProduct(product, qty);
    setQuantities(prev => ({ ...prev, [product.id]: 1 }));
  };

  const handleCreateProduct = () => {
    if (!newProduct.name || newProduct.purchasePrice < 0) return;
    const coeff = coefficients.products?.[newProduct.category] || 1.5;
    const finalPrice = newProduct.purchasePrice * coeff;
    
    const product = {
      ...newProduct,
      id: editingProduct?.id || Date.now().toString(),
      price: finalPrice,
      image: newProduct.images[0] || "", // Keep for legacy compatibility
      updatedAt: new Date().toISOString()
    };

    onSaveProduct(product);
    resetForm();
  };

  const resetForm = () => {
    setNewProduct({ 
      name: '', 
      category: productCategories[0], 
      purchasePrice: 0, 
      images: [],
      article: '',
      vendorArticle: '',
      manufacturerArticle: '',
      vat: 20,
      includeVat: true,
      color: '',
      description: '',
      unit: 'шт'
    });
    setEditingProduct(null);
    setIsAddingProduct(false);
  };

  const handleEditProduct = (product: any) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name || '',
      category: product.category || productCategories[0],
      purchasePrice: product.purchasePrice || 0,
      images: product.images || (product.image ? [product.image] : []),
      article: product.article || '',
      vendorArticle: product.vendorArticle || '',
      manufacturerArticle: product.manufacturerArticle || '',
      vat: product.vat || 20,
      includeVat: product.includeVat ?? true,
      color: product.color || '',
      description: product.description || '',
      unit: product.unit || 'шт'
    });
    setIsAddingProduct(true);
  };

  const handleDeleteProduct = (id: string | number) => {
    onDeleteProduct(id);
  };

  const filteredProducts = catalogProducts.filter(p => {
    const nameMatch = (p.name?.toLowerCase() || '').includes(search.toLowerCase());
    const descMatch = (p.description?.toLowerCase() || '').includes(search.toLowerCase());
    const articleMatch = (p.article?.toLowerCase() || '').includes(search.toLowerCase());
    const matchesSearch = nameMatch || descMatch || articleMatch;
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {currentChecklist && !showChecklistWindow && (
        <button
          onClick={() => setShowChecklistWindow(true)}
          className="fixed right-6 bottom-24 z-50 flex items-center justify-center p-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg shadow-blue-500/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-in slide-in-from-right-8 group"
        >
          <ClipboardList className="w-6 h-6 flex-shrink-0" />
          <span className="font-bold text-sm transition-all duration-300 overflow-hidden max-w-0 group-hover:max-w-[150px] group-hover:ml-2 opacity-0 group-hover:opacity-100 whitespace-nowrap">
            Чек-лист
          </span>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>
        </button>
      )}

      {showChecklistWindow && currentChecklist && (
        <div className="fixed inset-0 z-[100] flex items-center justify-end p-4 sm:p-6 pb-20 sm:pb-6 bg-black/20 backdrop-blur-sm pointer-events-auto" onClick={(e) => e.target === e.currentTarget && setShowChecklistWindow(false)}>
          <div className="w-full max-w-sm h-full max-h-[85vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-300">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 leading-tight">Чек-лист продаж</h3>
                  <p className="text-xs text-gray-500">{furnitureType}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowChecklistWindow(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 pb-10 space-y-6">
              <p className="text-sm text-gray-500 mb-2">Проверьте, не забыли ли вы предложить клиенту следующие позиции:</p>
              
              {currentChecklist.map((group, gIdx) => (
                <div key={gIdx} className="space-y-2">
                  <div className="h-px w-full bg-gradient-to-r from-gray-200 to-transparent mb-3" />
                  {group.items.map((item, idx) => {
                    const isRefused = checklistRefused?.[`${furnitureType}_${item}`];
                    const isPresent = isItemPresent(item);
                    
                    return (
                      <div key={idx} className={cn(
                        "flex items-center justify-between p-3 rounded-xl border transition-all group",
                        isRefused ? "bg-gray-50/50 border-gray-100 opacity-60" :
                        isPresent ? "bg-green-50/50 border-green-200" : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
                      )}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={cn(
                            "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                            isRefused ? "bg-gray-200 text-gray-500" :
                            isPresent ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"
                          )}>
                            {isRefused ? <UserX className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                          </div>
                          <span className={cn(
                            "text-sm font-medium truncate",
                            isRefused ? "text-gray-400 line-through" :
                            isPresent ? "text-green-800" : "text-gray-700"
                          )}>
                            {item}
                          </span>
                        </div>
                        
                        {!isPresent && !isRefused && setChecklistRefused && (
                          <button
                            onClick={() => setChecklistRefused(prev => ({...prev, [`${furnitureType}_${item}`]: true}))}
                            className="opacity-0 group-hover:opacity-100 ml-2 px-2 py-1 text-[10px] font-bold tracking-wider uppercase bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded flex-shrink-0 transition-all"
                            title="Клиенту не надо"
                          >
                            Отказ
                          </button>
                        )}
                        
                        {isRefused && setChecklistRefused && (
                          <button
                            onClick={() => {
                              if (!checklistRefused) return;
                              const newRefused = { ...checklistRefused };
                              delete newRefused[`${furnitureType}_${item}`];
                              setChecklistRefused(newRefused);
                            }}
                            className="opacity-0 group-hover:opacity-100 ml-2 px-2 py-1 text-[10px] font-bold tracking-wider uppercase text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded flex-shrink-0 transition-all"
                            title="Вернуть в список"
                          >
                            Вернуть
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Каталог товаров</h2>
          <p className="text-sm text-gray-500">Управление фурнитурой и аксессуарами</p>
        </div>
        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Поиск ..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
            />
          </div>
          <button 
            onClick={() => setIsAddingProduct(true)}
            className="flex items-center justify-center gap-2 px-6 h-10 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
          >
            <Plus className="w-5 h-5" />
            Добавить товар
          </button>
        </div>
      </div>

      {/* Categories Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        <button 
          onClick={() => setSelectedCategory(null)}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
            !selectedCategory ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300"
          )}
        >
          Все категории
        </button>
        {productCategories.map(cat => (
          <button 
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
              selectedCategory === cat ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300"
            )}
          >
            {cat}
          </button>
        ))}
        {userRole === 'admin' && (
          <button
            onClick={() => {
              const newCat = window.prompt('Введите название новой категории:');
              if (newCat && newCat.trim() && !productCategories.includes(newCat.trim())) {
                setProductCategories(prev => [...prev, newCat.trim()]);
                // Automatically save it via admin settings hook if required, 
                // but since we are modifying state it will persist when we save products or we need direct API call ?
                // The prompt requested 'нет возможности создать категорию товаров', this gives quick add mechanism.
              }
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all ml-1"
            title="Добавить категорию"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Product Modal */}
      {isAddingProduct && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="sticky top-0 bg-white z-10 p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{editingProduct ? 'Редактировать товар' : 'Новый товар'}</h3>
                <p className="text-sm text-gray-500">Заполните данные о товаре для каталога</p>
              </div>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Left Side: Basic Info */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Название товара</label>
                    <input 
                      type="text" 
                      value={newProduct.name}
                      onChange={e => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50/50"
                      placeholder="Например: Петля Blum Clip Top"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Категория</label>
                      <select
                        value={newProduct.category}
                        onChange={e => setNewProduct(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50/50"
                      >
                        {productCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Ед. измерения</label>
                      <select
                        value={newProduct.unit}
                        onChange={e => setNewProduct(prev => ({ ...prev, unit: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50/50"
                      >
                        <option value="шт">Шт</option>
                        <option value="компл">Комплект</option>
                        <option value="м.п.">М.п.</option>
                        <option value="упак">Упаковка</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Артикул</label>
                      <input 
                        type="text" 
                        value={newProduct.article}
                        onChange={e => setNewProduct(prev => ({ ...prev, article: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50/50"
                        placeholder="Внутренний артикул"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Арт. поставщика</label>
                        <input 
                          type="text" 
                          value={newProduct.vendorArticle}
                          onChange={e => setNewProduct(prev => ({ ...prev, vendorArticle: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Арт. производителя</label>
                        <input 
                          type="text" 
                          value={newProduct.manufacturerArticle}
                          onChange={e => setNewProduct(prev => ({ ...prev, manufacturerArticle: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50/50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-blue-900">Закупочная цена (без НДС)</label>
                      <div className="relative w-32">
                        <input 
                          type="number" 
                          value={newProduct.purchasePrice || ''}
                          onChange={e => setNewProduct(prev => ({ ...prev, purchasePrice: parseFloat(e.target.value) || 0 }))}
                          className="w-full pl-4 pr-10 py-2 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-700"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 font-bold">₽</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 border-t border-blue-100 pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-blue-600 font-bold uppercase">НДС (%)</span>
                        <input 
                          type="number" 
                          value={newProduct.vat}
                          onChange={e => setNewProduct(prev => ({ ...prev, vat: parseInt(e.target.value) || 0 }))}
                          className="w-16 px-2 py-1 border border-blue-200 rounded-lg text-center font-bold text-blue-700"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={newProduct.includeVat}
                          onChange={e => setNewProduct(prev => ({ ...prev, includeVat: e.target.checked }))}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-xs text-blue-600 font-medium">НДС включен в цену</span>
                      </label>
                    </div>

                    <div className="pt-2">
                      <div className="flex justify-between items-center text-sm font-bold text-blue-900 mb-1">
                        <span>Итоговая цена для клиента:</span>
                        <span className="text-xl">
                          {(newProduct.purchasePrice * (coefficients.products?.[newProduct.category] || 1.5)).toLocaleString()} ₽
                        </span>
                      </div>
                      <p className="text-[10px] text-blue-500 italic">
                        * Рассчитано автоматически на основе коэффициента категории "{newProduct.category}" ({coefficients.products?.[newProduct.category] || 1.5})
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Side: Media & Details */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Фотографии товара</label>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {newProduct.images.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group">
                          <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button 
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {newProduct.images.length < 6 && (
                        <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all text-gray-400">
                          <Upload className="w-6 h-6 mb-1" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Загрузить</span>
                          <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
                        </label>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Цвет / Декор</label>
                    <div className="relative">
                      <Palette className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input 
                        type="text" 
                        value={newProduct.color}
                        onChange={e => setNewProduct(prev => ({ ...prev, color: e.target.value }))}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50/50"
                        placeholder="Например: Хром матовый"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Описание товара</label>
                    <textarea 
                      value={newProduct.description}
                      onChange={e => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50/50 h-32 resize-none"
                      placeholder="Характеристики, состав, особенности..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-10 pt-6 border-t border-gray-100">
                <button 
                  onClick={resetForm}
                  className="px-8 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Отмена
                </button>
                <button 
                  onClick={handleCreateProduct}
                  disabled={!newProduct.name}
                  className="px-12 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:bg-gray-300"
                >
                  {editingProduct ? 'Сохранить изменения' : 'Добавить в каталог'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product List */}
      {catalogProducts.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-800">Каталог товаров пуст</h3>
          <p className="text-gray-500 mb-6">Начните с добавления первого товара в вашу базу</p>
          <button 
            onClick={() => setIsAddingProduct(true)}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Добавить товар
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => {
            const displayImage = product.images?.[0] || product.image;
            return (
              <div key={product.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col relative">
                <div className="relative h-56 overflow-hidden bg-gray-100 flex items-center justify-center">
                  {displayImage ? (
                    <img 
                      src={displayImage} 
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400 w-full h-full">
                      <ImageIcon className="w-12 h-12 text-gray-200 mb-2" strokeWidth={1.5} />
                      <span className="text-[10px] uppercase font-bold tracking-widest text-gray-300">Нет фото</span>
                    </div>
                  )}
                  
                  {/* Overlay Badges */}
                  <div className="absolute top-4 left-4 flex flex-col gap-2">
                    <span className="px-2 py-1 bg-white/95 backdrop-blur shadow-sm text-[10px] font-bold uppercase tracking-wider text-blue-600 rounded-lg">
                      {product.category}
                    </span>
                    {product.article && (
                      <span className="px-2 py-1 bg-gray-900/80 backdrop-blur text-white text-[10px] font-medium tracking-tight rounded-lg">
                        Арт: {product.article}
                      </span>
                    )}
                  </div>

                  {/* Quick Actions */}
                  {product.source !== 'manufacturer' && (
                    <div className="absolute top-4 right-4 flex flex-col gap-2 translate-x-12 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300">
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="p-2 bg-white text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl shadow-lg transition-all"
                        title="Редактировать"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-2 bg-white text-red-500 hover:bg-red-500 hover:text-white rounded-xl shadow-lg transition-all"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 line-clamp-2 leading-snug">{product.name}</h3>
                    </div>
                    {product.color && (
                      <div className="flex items-center gap-1.5 mb-3">
                        <Palette className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{product.color}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-50 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Цена для клиента</span>
                        <span className="text-xl font-black text-gray-900">{(product.price ?? 0).toLocaleString()} ₽</span>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-xl">
                        <button 
                          onClick={() => setQuantities(prev => ({ ...prev, [product.id]: Math.max(1, (prev[product.id] || 1) - 1) }))}
                          className="p-1 hover:bg-white rounded-lg text-gray-500 transition-all active:scale-90"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-bold text-sm">{quantities[product.id] || 1}</span>
                        <button 
                          onClick={() => setQuantities(prev => ({ ...prev, [product.id]: (prev[product.id] || 1) + 1 }))}
                          className="p-1 hover:bg-white rounded-lg text-gray-500 transition-all active:scale-90"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleAdd(product)}
                      className="w-full py-3 bg-blue-50 text-blue-600 font-bold rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 group/btn"
                    >
                      <ShoppingBag className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                      Добавить в проект
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {catalogProducts.length > 0 && filteredProducts.length === 0 && (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">Ничего не найдено</h3>
          <p className="text-gray-500">Попробуйте изменить параметры поиска или категорию</p>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'landing'>('landing');
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'worker' | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [companyData, setCompanyData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAppAdmin, setIsAppAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const [productionFormat, setProductionFormat] = useState<ProductionFormat>('contract');
  const [productionSettings, setProductionSettings] = useState<any>(null);
  const [contractConfig, setContractConfig] = useState<ContractConfig>({
    cabinet: { enabled: false, calculateForClients: false },
    facades: { enabled: false, calculateForClients: false },
    hardware: { enabled: false, calculateForClients: false },
    assembly: { enabled: false, calculateForClients: false },
    delivery: { enabled: false, calculateForClients: false },
    city: '',
    productionId: ''
  });
  
  const [ownProductionConfig, setOwnProductionConfig] = useState<OwnProductionConfig>({
    ldspBrands: [
      { id: '1', brand: 'Egger', format: '2800x2070' },
      { id: '2', brand: 'Kronospan', format: '2750x1830' },
      { id: '3', brand: 'Lamarty', format: '2750x1830' },
      { id: '4', brand: 'Nordeco', format: '2750x1830' },
      { id: '5', brand: 'AGT', format: '2800x1220' },
      { id: '6', brand: 'Evogloss', format: '2800x1220' },
      { id: '7', brand: 'Arkopa', format: '2800x1220' },
      { id: '8', brand: 'Evosoft', format: '2800x1220' },
      { id: '9', brand: 'AGT SUPRAMATT', format: '2800x1220' },
      { id: '10', brand: 'AGT SUPRAMATT PUR', format: '2800x1220' },
      { id: '11', brand: 'EVOSOFT PUR', format: '2800x1220' },
      { id: '12', brand: 'ХДФ', format: '2800x2070' }
    ],
    edgeTypes: { eva: true, pur: false },
    edgeThicknesses: { '0.4': true, '0.8': false, '1.0': true, '2.0': true },
    drilling: { cnc: true, manual: false },
    facades: { 'Пленка ПВХ': true, 'Эмаль': true, 'Пластик': false, 'Шпон': false, 'Массив': false },
    customFacades: [],
    address: '',
    photos: []
  });

  // Removed the auto-redirect to admin panel
  // Users will access it manually using the button in the bottom left menu

  // Firebase Auth Listener
  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;
    let unsubscribeCompany: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const superAdminEmails = ["ivanbobkin5@gmail.com", "lk.ivanbobkin@gmail.com"];
        const isSuper = superAdminEmails.includes(user.email || '');
        setIsAppAdmin(isSuper);

        // Listen to user document
        unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), async (userDoc) => {
          if (userDoc.exists()) {
            const uData = userDoc.data();
            setUserData({ uid: user.uid, ...uData });
            setUserRole(uData.role);
            
            if (uData.isBlocked) {
              setIsBlocked(true);
              setIsAuthenticated(false);
              setIsLoading(false);
              return;
            }

            // Listen to company document
            if (uData.companyId) {
              if (unsubscribeCompany) unsubscribeCompany();
              unsubscribeCompany = onSnapshot(doc(db, 'companies', uData.companyId), (companyDoc) => {
                if (companyDoc.exists()) {
                  const cData = companyDoc.data();
                  setCompanyData({ id: companyDoc.id, ...cData });
                  
                  if (cData.isBlocked) {
                    setIsBlocked(true);
                    setIsAuthenticated(false);
                  } else {
                    setIsBlocked(false);
                    setIsAuthenticated(true);
                  }

                  if (cData.productionFormat) {
                    setProductionFormat(cData.productionFormat);
                  }
                }
                setIsLoading(false);
              }, (error) => {
                console.error("Company snapshot error:", error);
                setIsLoading(false);
              });
            } else if (isSuper) {
              setIsAuthenticated(true);
              setIsLoading(false);
            }
          } else if (isSuper) {
            // Super admin might not have a user doc yet, create it if needed or just allow access
            setIsAppAdmin(true);
            setIsAuthenticated(true);
            setIsLoading(false);
          } else {
            setIsLoading(false);
          }
        }, (error) => {
          console.error("User snapshot error:", error);
          setIsLoading(false);
        });
      } else {
        if (unsubscribeUser) unsubscribeUser();
        if (unsubscribeCompany) unsubscribeCompany();
        setIsAuthenticated(false);
        setIsAppAdmin(false);
        setIsBlocked(false);
        setUserRole(null);
        setCompanyData(null);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeCompany) unsubscribeCompany();
    };
  }, []);

  const handleLogin = async (data: any) => {
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
    } catch (error) {
      showAlert("Ошибка входа", (error as Error).message);
    }
  };

  const handleRegister = async (data: RegistrationData) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.adminEmail, data.adminPassword);
      const user = userCredential.user;

      const companyId = Math.random().toString(36).substr(2, 9);
      
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 14);

      // Create company
      await setDoc(doc(db, 'companies', companyId), {
        name: data.companyName,
        type: data.companyType,
        city: data.city,
        ownerUid: user.uid,
        tariffExpiration: expirationDate.toISOString()
      });

      // Create user
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: data.adminEmail,
        displayName: data.adminName,
        role: 'admin',
        companyId: companyId,
        createdAt: new Date().toISOString()
      });

      // Initialize settings
      await setDoc(doc(db, 'companies', companyId, 'settings', 'categories'), {
        categories: INITIAL_PRODUCT_CATEGORIES,
        coefficients: INITIAL_PRODUCT_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: 1.5 }), {})
      });

    } catch (error) {
      showAlert("Ошибка регистрации", (error as Error).message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const [activeTab, setActiveTab] = useState<'calculator' | 'price' | 'summary' | 'settings' | 'products' | 'services' | 'service-section' | 'production' | 'employees' | 'projects' | 'specification'>('calculator');
  const [selectedProjectForSpec, setSelectedProjectForSpec] = useState<any | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [results, setResults] = useState<any>(null);
  const [rotations, setRotations] = useState<Record<string, boolean>>({});
  const [edgeToEdge, setEdgeToEdge] = useState<Record<string, boolean>>({});
  const [sheetConfigs, setSheetConfigs] = useState<Record<string, SheetConfig>>({});
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [trimming, setTrimming] = useState(10);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null);

  // Custom Modal State
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'prompt';
    title: string;
    message: string;
    value?: string;
    onConfirm?: (value?: string) => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    type: 'alert',
    title: '',
    message: ''
  });

  const [allCompanies, setAllCompanies] = useState<any[]>([]);
  const [salonsUsingMe, setSalonsUsingMe] = useState<any[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'companies'), (snapshot) => {
      const companies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setAllCompanies(companies);
      
      if (companyData?.id) {
        const mySalons = companies.filter(c => c.manufacturerId === companyData.id);
        setSalonsUsingMe(mySalons);
      }
    });
    return () => unsubscribe();
  }, [companyData?.id]);

  const updateSalonCoefficient = (salonId: string, category: string, value: string) => {
    const numValue = parseFloat(value) || 1;
    setOwnProductionConfig(prev => ({
      ...prev,
      salonCoefficients: {
        ...prev.salonCoefficients,
        [salonId]: {
          ...(prev.salonCoefficients?.[salonId] || {}),
          [category]: numValue
        }
      }
    }));
  };

  const updateStandardCoefficient = (category: string, value: string) => {
    const numValue = parseFloat(value) || 1;
    setOwnProductionConfig(prev => ({
      ...prev,
      standardCoefficients: {
        ...(prev.standardCoefficients || {}),
        [category]: numValue
      }
    }));
  };

  const toggleSpecialCondition = (salonId: string) => {
    setOwnProductionConfig(prev => {
      const currentIds = prev.specialConditionIds || [];
      const newIds = currentIds.includes(salonId)
        ? currentIds.filter(id => id !== salonId)
        : [...currentIds, salonId];
      return { ...prev, specialConditionIds: newIds };
    });
  };

  const salonsInTable = useMemo(() => {
    return salonsUsingMe.filter(s => ownProductionConfig.specialConditionIds?.includes(s.id));
  }, [salonsUsingMe, ownProductionConfig.specialConditionIds]);

  const showAlert = (title: string, message: string) => {
    setModal({ isOpen: true, type: 'alert', title, message });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModal({ isOpen: true, type: 'confirm', title, message, onConfirm });
  };

  const showPrompt = (title: string, message: string, defaultValue: string, onConfirm: (value: string) => void) => {
    setModal({ isOpen: true, type: 'prompt', title, message, value: defaultValue, onConfirm: (val) => onConfirm(val || '') });
  };

  const [defaultCuttingType, setDefaultCuttingType] = useState<'saw' | 'nesting'>('saw');
  const [cuttingType, setCuttingType] = useState<'nesting' | 'saw'>('saw');
  const [isGluingMode, setIsGluingMode] = useState(false);
  const [selectedForGlue, setSelectedForGlue] = useState<string[]>([]);
  const [gluedAssemblies, setGluedAssemblies] = useState<Record<string, { partIds: string[], edgeThickness: number, edgePrice: number }>>({});
  
  const [furnitureType, setFurnitureType] = useState<string>('');
  const [checklistRefused, setChecklistRefused] = useState<Record<string, boolean>>({});

  const [companyInfo, setCompanyInfo] = useState<any>({
    name: '',
    legalForm: 'ИП',
    director: '',
    inn: '',
    ogrn: '',
    taxSystem: 'УСН Доходы',
    taxRate: 6,
    bankName: '',
    bik: '',
    rs: '',
    ks: '',
    vat: 0,
    phone: '',
    legalAddress: '',
    website: '',
    socials: { vk: '', telegram: '' }
  });

  useEffect(() => {
    setCuttingType(defaultCuttingType);
    setKerf(defaultCuttingType === 'nesting' ? 12 : 4);
  }, [defaultCuttingType]);
  const [kerf, setKerf] = useState(defaultCuttingType === 'nesting' ? 12 : 4);
  const [addedProducts, setAddedProducts] = useState<any[]>([]);
  const [addedServices, setAddedServices] = useState<any[]>([]);
  const [assemblyPercentage, setAssemblyPercentage] = useState(12);
  const [mapLink, setMapLink] = useState('https://yandex.ru/maps/');
  
  const [ownProducts, setOwnProducts] = useState<any[]>([]);
  const [manufacturerProducts, setManufacturerProducts] = useState<any[]>([]);
  
  const catalogProducts = useMemo(() => {
    return [...ownProducts, ...manufacturerProducts];
  }, [ownProducts, manufacturerProducts]);

  const [catalogServices, setCatalogServices] = useState<any[]>(SERVICES_LIST);
  const [productCategories, setProductCategories] = useState<string[]>(INITIAL_PRODUCT_CATEGORIES);

  const [showManufacturerCoeffs, setShowManufacturerCoeffs] = useState(false);

  // Data Synchronization
  useEffect(() => {
    if (!isAuthenticated || !companyData?.id) return;

    const companyId = companyData.id;

    // Sync Products
    const productsUnsubscribe = onSnapshot(
      collection(db, 'companies', companyId, 'products'),
      (snapshot) => {
        const products = snapshot.docs.map(doc => ({ ...doc.data(), source: 'own' }));
        console.log("Loaded own products:", products);
        setOwnProducts(products);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `companies/${companyId}/products`)
    );

    // Sync Manufacturer Products if in contract mode
    let manufacturerProductsUnsubscribe = () => {};
    if (productionFormat === 'contract' && companyData.manufacturerId) {
      manufacturerProductsUnsubscribe = onSnapshot(
        collection(db, 'companies', companyData.manufacturerId, 'products'),
        (snapshot) => {
          const products = snapshot.docs.map(doc => ({ ...doc.data(), source: 'manufacturer' }));
          console.log("Loaded manufacturer products:", products);
          setManufacturerProducts(products);
        },
        (error) => {
          // It's okay if we can't read it yet or if it doesn't exist
          console.warn("Could not load manufacturer products:", error);
          setManufacturerProducts([]);
        }
      );
    } else {
      setManufacturerProducts([]);
    }

    // Sync Categories & Coefficients
    const settingsUnsubscribe = onSnapshot(
      doc(db, 'companies', companyId, 'settings', 'categories'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setProductCategories(data.categories || INITIAL_PRODUCT_CATEGORIES);
          setCoefficients(prev => ({ ...prev, products: data.coefficients || {} }));
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `companies/${companyId}/settings/categories`)
    );

    // Sync Production Config
    const productionUnsubscribe = onSnapshot(
      doc(db, 'companies', companyId, 'settings', 'production'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if ('productionId' in data || 'city' in data) {
            setContractConfig(data as ContractConfig);
          } else {
            setOwnProductionConfig(prev => ({
              ...prev,
              ...data,
              specialConditionIds: (data as any).specialConditionIds || [],
              standardCoefficients: (data as any).standardCoefficients || {},
              salonCoefficients: (data as any).salonCoefficients || {}
            } as OwnProductionConfig));
          }
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `companies/${companyId}/settings/production`)
    );

    // Sync General Settings
    const generalSettingsUnsubscribe = onSnapshot(
      doc(db, 'companies', companyId, 'settings', 'general'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.productCategories) setProductCategories(data.productCategories);
          if (data.defaultCuttingType) setDefaultCuttingType(data.defaultCuttingType);
          if (data.companyInfo) setCompanyInfo(data.companyInfo);
          if (data.coefficients) {
            // Ensure structure is correct
            if (data.coefficients.retail && data.coefficients.wholesale && data.coefficients.designer) {
              setCoefficients(data.coefficients);
            } else {
              // Migration for old format
              const migrated = { ...data.coefficients };
              if (!migrated.retail) {
                migrated.retail = {
                  ldsp: data.coefficients.ldsp || 4,
                  hdf: data.coefficients.hdf || 4,
                  edge: data.coefficients.edge || 4,
                  facadeSheet: data.coefficients.facadeSheet || 1.8,
                  products: data.coefficients.products || {}
                };
                migrated.wholesale = {
                  ldsp: data.coefficients.ldsp || 2,
                  hdf: data.coefficients.hdf || 2,
                  edge: data.coefficients.edge || 2,
                  facadeSheet: data.coefficients.facadeSheet || 1.2,
                  products: data.coefficients.products || {}
                };
              }
              if (!migrated.designer) {
                migrated.designer = {
                  ldsp: (migrated.wholesale?.ldsp || 2) * 1.2,
                  hdf: (migrated.wholesale?.hdf || 2) * 1.2,
                  edge: (migrated.wholesale?.edge || 2) * 1.2,
                  facadeSheet: (migrated.wholesale?.facadeSheet || 1.2) * 1.1,
                  products: migrated.wholesale?.products || {}
                };
              }
              setCoefficients(migrated);
            }
          }
          if (data.calcMode) setCalcMode(data.calcMode);
          if (data.trimming !== undefined) setTrimming(data.trimming);
          if (data.hardwareKitPrice !== undefined) setHardwareKitPrice(data.hardwareKitPrice);
          if (data.assemblyPercentage !== undefined) setAssemblyPercentage(data.assemblyPercentage);
          if (data.deliveryTariffs) setDeliveryTariffs(data.deliveryTariffs);
          if (data.mapLink) setMapLink(data.mapLink);
          if (data.productCategories) setProductCategories(data.productCategories);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `companies/${companyId}/settings/general`)
    );

    return () => {
      productsUnsubscribe();
      manufacturerProductsUnsubscribe();
      settingsUnsubscribe();
      productionUnsubscribe();
      generalSettingsUnsubscribe();
    };
  }, [isAuthenticated, companyData?.id, productionFormat, companyData?.manufacturerId]);

  // Sync Production Settings (for Contract mode)
  useEffect(() => {
    if (productionFormat !== 'contract' || !contractConfig.productionId) {
      setProductionSettings(null);
      return;
    }

    const prodId = contractConfig.productionId;
    
    // Sync Production's Categories (for coefficients)
    const unsubCategories = onSnapshot(doc(db, 'companies', prodId, 'settings', 'categories'), (doc) => {
      if (doc.exists()) {
        setProductionSettings(prev => ({ 
          ...prev, 
          categories: doc.data()
        }));
      }
    });

    const unsubGeneral = onSnapshot(doc(db, 'companies', prodId, 'settings', 'general'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setProductionSettings(prev => ({ 
          ...prev, 
          general: data
        }));
        // Auto-apply locked settings
        if (data.defaultCuttingType) {
          setDefaultCuttingType(data.defaultCuttingType);
          setCuttingType(data.defaultCuttingType);
        }
        if (data.trimming !== undefined) setTrimming(data.trimming);
        if (data.mapLink) setMapLink(data.mapLink);
      }
    });

    const unsubProduction = onSnapshot(doc(db, 'companies', prodId, 'settings', 'production'), (doc) => {
      if (doc.exists()) {
        setProductionSettings(prev => ({ 
          ...prev, 
          production: doc.data()
        }));
      }
    });

    return () => {
      unsubCategories();
      unsubGeneral();
      unsubProduction();
    };
  }, [productionFormat, contractConfig.productionId]);

  // Save actions
  const saveProject = async (projectName: string) => {
    if (!companyData?.id || !userData?.uid) return;
    try {
      const projectId = currentProjectId || Date.now().toString();
      const projectData: any = {
        id: projectId,
        name: projectName,
        updatedAt: new Date().toISOString(),
        createdBy: userData.uid,
        createdByName: userData.name,
        data: {
          results,
          selectedDecor,
          prices,
          facadeType,
          sheetConfigs,
          trimming,
          kerf,
          rotations,
          cuttingType,
          calcMode,
          edgeToEdge,
          edgePrices,
          edgeThickness,
          edgeDecor,
          facadeCustomType,
          facadeCategory,
          facadeMilling,
          facadeThicknessOverride,
          addedProducts,
          addedServices,
          serviceData,
          furnitureType,
          checklistRefused
        }
      };
      
      if (!currentProjectId) {
        projectData.createdAt = new Date().toISOString();
      }

      // Не ждем ответа от сервера (await), чтобы оффлайн сохранение работало мгновенно
      setDoc(doc(db, 'companies', companyData.id, 'projects', projectId), projectData, { merge: true }).catch(error => {
        console.error("Ошибка фонового сохранения проекта:", error);
      });
      
      setCurrentProjectId(projectId);
      setCurrentProjectName(projectName);
      showAlert('Успех', !navigator.onLine ? 'Проект сохранен (оффлайн режим). Данные синхронизируются при появлении сети.' : 'Проект успешно сохранен');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `companies/${companyData.id}/projects`);
    }
  };

  const loadProject = (project: any) => {
    const d = project.data;
    if (d.results) setResults(d.results);
    if (d.selectedDecor) setSelectedDecor(d.selectedDecor);
    if (d.prices) setPrices(d.prices);
    if (d.facadeType) setFacadeType(d.facadeType);
    if (d.sheetConfigs) setSheetConfigs(d.sheetConfigs);
    if (d.trimming !== undefined) setTrimming(d.trimming);
    if (d.kerf !== undefined) setKerf(d.kerf);
    if (d.rotations) setRotations(d.rotations);
    if (d.cuttingType) setCuttingType(d.cuttingType);
    if (d.calcMode) setCalcMode(d.calcMode);
    if (d.edgeToEdge) setEdgeToEdge(d.edgeToEdge);
    if (d.edgePrices) setEdgePrices(d.edgePrices);
    if (d.edgeThickness) setEdgeThickness(d.edgeThickness);
    if (d.edgeDecor) setEdgeDecor(d.edgeDecor);
    if (d.facadeCustomType) setFacadeCustomType(d.facadeCustomType);
    if (d.facadeCategory) setFacadeCategory(d.facadeCategory);
    if (d.facadeMilling) setFacadeMilling(d.facadeMilling);
    if (d.facadeThicknessOverride) setFacadeThicknessOverride(d.facadeThicknessOverride);
    if (d.addedProducts) setAddedProducts(d.addedProducts);
    if (d.addedServices) setAddedServices(d.addedServices);
    if (d.serviceData) setServiceData(d.serviceData);
    if (d.furnitureType) setFurnitureType(d.furnitureType);
    if (d.checklistRefused) setChecklistRefused(d.checklistRefused);
    
    setCurrentProjectId(project.id);
    setCurrentProjectName(project.name);
    setActiveTab('calculator');
  };

  const saveProduct = async (product: any) => {
    if (!companyData?.id) return;
    try {
      await setDoc(doc(db, 'companies', companyData.id, 'products', product.id.toString()), product);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `companies/${companyData.id}/products/${product.id}`);
    }
  };

  const deleteProduct = async (productId: string | number) => {
    if (!companyData?.id) return;
    try {
      await deleteDoc(doc(db, 'companies', companyData.id, 'products', productId.toString()));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `companies/${companyData.id}/products/${productId}`);
    }
  };

  const saveProductionConfig = async () => {
    if (!companyData?.id) return;
    try {
      const isOwn = productionFormat === 'own' || companyData?.type === 'Мебельное производство';
      const config = isOwn ? ownProductionConfig : contractConfig;
      
      await setDoc(doc(db, 'companies', companyData.id, 'settings', 'production'), config);
      
      // Also save productionFormat and manufacturerId to company document
      await setDoc(doc(db, 'companies', companyData.id), { 
        productionFormat: isOwn ? 'own' : 'contract',
        manufacturerId: isOwn ? null : (contractConfig.productionId || null)
      }, { merge: true });
      
      showAlert('Успех', 'Настройки производства сохранены');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `companies/${companyData.id}/settings/production`);
    }
  };

  const saveGeneralSettings = async () => {
    if (!companyData?.id) return;
    try {
      await setDoc(doc(db, 'companies', companyData.id, 'settings', 'general'), {
        coefficients,
        calcMode,
        trimming,
        hardwareKitPrice,
        assemblyPercentage,
        deliveryTariffs,
        mapLink,
        productCategories,
        defaultCuttingType,
        companyInfo
      });
      
      // If production, also save production settings (which contain salon coefficients)
      if (companyData.type === 'Мебельное производство') {
        await setDoc(doc(db, 'companies', companyData.id, 'settings', 'production'), ownProductionConfig);
      }

      showAlert('Успех', 'Настройки успешно сохранены');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `companies/${companyData.id}/settings/general`);
    }
  };

  const canEditCabinet = productionFormat === 'own' || !contractConfig.cabinet.enabled || contractConfig.cabinet.calculateForClients;
  const canEditFacades = productionFormat === 'own' || !contractConfig.facades.enabled || contractConfig.facades.calculateForClients;
  const canEditHardware = productionFormat === 'own' || !contractConfig.hardware.enabled || contractConfig.hardware.calculateForClients;
  const canEditAssembly = productionFormat === 'own' || !contractConfig.assembly.enabled || contractConfig.assembly.calculateForClients;
  const canEditDelivery = productionFormat === 'own' || !contractConfig.delivery.enabled || contractConfig.delivery.calculateForClients;

  const [deliveryTariffs, setDeliveryTariffs] = useState<DeliveryTariffs>({
    basePrice: 3000,
    baseDistance: 30,
    baseVolume: 10,
    extraKmPrice: 50,
    extraVolumePrice: 200,
    extraLoaderPrice: 1000,
    loadingBase: 500,
    floorPrice: 200,
    elevatorPrice: 500
  });
  const [serviceData, setServiceData] = useState({
    address: {
      street: '',
      house: '',
      apartment: '',
      floor: '',
      elevator: 'none' as 'passenger' | 'cargo' | 'none'
    },
    delivery: false,
    assembly: false,
    distance: 0,
    extraLoader: false
  });

  const handleCuttingTypeChange = (type: 'nesting' | 'saw') => {
    setCuttingType(type);
    setKerf(type === 'nesting' ? 12 : 4);
  };

  const toggleRotation = (key: string) => {
    setRotations(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleEdgeToEdge = (key: string) => {
    setEdgeToEdge(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleExpanded = (key: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onAddProduct = (product: any, quantity: number = 1) => {
    setAddedProducts(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) {
        return prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + quantity } : p);
      }
      return [...prev, { ...product, quantity }];
    });
    setActiveTab('summary');
  };

  const onAddService = (service: any, quantity: number = 1) => {
    setAddedServices(prev => {
      const existing = prev.find(s => s.id === service.id);
      if (existing) {
        return prev.map(s => s.id === service.id ? { ...s, quantity: s.quantity + quantity } : s);
      }
      return [...prev, { ...service, quantity }];
    });
    setActiveTab('summary');
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [facadeSearchQuery, setFacadeSearchQuery] = useState('');
  const [selectedDecor, setSelectedDecor] = useState<Record<string, string>>({});
  const [edgeThickness, setEdgeThickness] = useState<Record<string, string>>({});
  const [edgeDecor, setEdgeDecor] = useState<Record<string, string>>({});
  const [facadeType, setFacadeType] = useState<Record<string, 'sheet' | 'custom'>>({});
  const [facadeCustomType, setFacadeCustomType] = useState<Record<string, 'Пленка' | 'Эмаль' | 'AGT SUPRAMATT PUR' | 'EVOSOFT PUR'>>({});
  const [facadeCategory, setFacadeCategory] = useState<Record<string, string>>({});
  const [facadeMilling, setFacadeMilling] = useState<Record<string, string>>({});
  const [facadeThicknessOverride, setFacadeThicknessOverride] = useState<Record<string, string>>({});
  const [edgePrices, setEdgePrices] = useState<Record<string, number>>({});
  const [mergedMaterials, setMergedMaterials] = useState<Record<string, string>>({});
  const [calcMode, setCalcMode] = useState<'sheet' | 'area'>('area');
  const [coefficients, setCoefficients] = useState({
    retail: {
      ldsp: 4,
      hdf: 4,
      edge: 4,
      facadeSheet: 1.8,
      facadeCustom: 1.5,
      hardware: 1.5,
      assembly: 1.5,
      delivery: 1.5,
      products: INITIAL_PRODUCT_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: 1.5 }), {} as Record<string, number>)
    },
    wholesale: {
      ldsp: 2,
      hdf: 2,
      edge: 2,
      facadeSheet: 1.2,
      facadeCustom: 1.2,
      hardware: 1.2,
      assembly: 1.2,
      delivery: 1.2,
      products: INITIAL_PRODUCT_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: 1.2 }), {} as Record<string, number>)
    },
    designer: {
      ldsp: 2.5,
      hdf: 2.5,
      edge: 2.5,
      facadeSheet: 1.3,
      facadeCustom: 1.3,
      hardware: 1.3,
      assembly: 1.3,
      delivery: 1.3,
      products: INITIAL_PRODUCT_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: 1.3 }), {} as Record<string, number>)
    }
  });
  const [hardwareKitPrice, setHardwareKitPrice] = useState<{ retail: number; wholesale: number; designer: number }>({ retail: 500, wholesale: 400, designer: 450 });
  const [customerType, setCustomerType] = useState<'retail' | 'wholesale' | 'designer'>('retail');

  const currentHardwareKitPrice = useMemo(() => {
    const price = hardwareKitPrice as any;
    if (typeof price === 'number') return price;
    return price[customerType] || 500;
  }, [hardwareKitPrice, customerType]);

  const filteredDecors = useMemo(() => {
    const allDecors: { brand: string; name: string }[] = [];
    Object.entries(LDSP_DATABASE).forEach(([brand, decors]) => {
      decors.forEach(name => allDecors.push({ brand, name }));
    });
    return allDecors.filter(d => 
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      d.brand.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const filteredHdfDecors = useMemo(() => {
    return (LDSP_DATABASE["ХДФ"] || []).filter(name => 
      name.toLowerCase().includes(searchQuery.toLowerCase())
    ).map(name => ({ brand: "ХДФ", name }));
  }, [searchQuery]);

  const filteredFacadeDecors = useMemo(() => {
    const allDecors: { brand: string; name: string }[] = [];
    Object.entries(LDSP_DATABASE).forEach(([brand, decors]) => {
      decors.forEach(name => allDecors.push({ brand, name }));
    });
    return allDecors.filter(d => 
      d.name.toLowerCase().includes(facadeSearchQuery.toLowerCase()) || 
      d.brand.toLowerCase().includes(facadeSearchQuery.toLowerCase())
    );
  }, [facadeSearchQuery]);

  const handleNewProject = () => {
    localStorage.removeItem('mebcalc_draft');
    setCurrentProjectId(null);
    setCurrentProjectName('Новый проект');
    setResults(null);
    setSelectedDecor({});
    setPrices({});
    setFacadeType({});
    setFacadeCustomType({});
    setFacadeCategory({});
    setFacadeMilling({});
    setFacadeThicknessOverride({});
    setSheetConfigs({});
    setTrimming(10);
    setKerf(4);
    setRotations({});
    setCuttingType('saw');
    setEdgeToEdge({});
    setEdgePrices({});
    setMergedMaterials({});
    setEdgeThickness({});
    setEdgeDecor({});
    setAddedProducts([]);
    setAddedServices([]);
    setFurnitureType('');
    setChecklistRefused({});
    setServiceData({
      address: { street: '', house: '', apartment: '', floor: '', elevator: 'none' },
      delivery: false,
      assembly: false,
      distance: 0,
      extraLoader: false
    });
    showAlert('Новый проект', 'Вы начали новый проект');
  };

  // Initialize draft from localStorage
  useEffect(() => {
    const savedDraft = localStorage.getItem('mebcalc_draft');
    if (savedDraft) {
      try {
        const d = JSON.parse(savedDraft);
        if (d.results) setResults(d.results);
        if (d.selectedDecor) setSelectedDecor(d.selectedDecor);
        if (d.prices) setPrices(d.prices);
        if (d.facadeType) setFacadeType(d.facadeType);
        if (d.sheetConfigs) setSheetConfigs(d.sheetConfigs);
        if (d.trimming !== undefined) setTrimming(d.trimming);
        if (d.kerf !== undefined) setKerf(d.kerf);
        if (d.rotations) setRotations(d.rotations);
        if (d.cuttingType) setCuttingType(d.cuttingType);
        if (d.calcMode) setCalcMode(d.calcMode);
        if (d.edgeToEdge) setEdgeToEdge(d.edgeToEdge);
        if (d.edgePrices) setEdgePrices(d.edgePrices);
        if (d.edgeThickness) setEdgeThickness(d.edgeThickness);
        if (d.edgeDecor) setEdgeDecor(d.edgeDecor);
        if (d.facadeCustomType) setFacadeCustomType(d.facadeCustomType);
        if (d.facadeCategory) setFacadeCategory(d.facadeCategory);
        if (d.facadeMilling) setFacadeMilling(d.facadeMilling);
        if (d.facadeThicknessOverride) setFacadeThicknessOverride(d.facadeThicknessOverride);
        if (d.addedProducts) setAddedProducts(d.addedProducts);
        if (d.addedServices) setAddedServices(d.addedServices);
        if (d.serviceData) setServiceData(d.serviceData);
        if (d.furnitureType) setFurnitureType(d.furnitureType);
        if (d.checklistRefused) setChecklistRefused(d.checklistRefused);
        if (d.mergedMaterials) setMergedMaterials(d.mergedMaterials);
        if (d.currentProjectId) setCurrentProjectId(d.currentProjectId);
        if (d.currentProjectName) setCurrentProjectName(d.currentProjectName);
      } catch (e) {
        console.error('Failed to parse draft calculation', e);
      }
    }
  }, []);

  useEffect(() => {
    if (results || addedProducts.length > 0 || addedServices.length > 0) {
      const draftState = {
        results, selectedDecor, prices, facadeType, sheetConfigs,
        trimming, kerf, rotations, cuttingType, calcMode, edgeToEdge,
        edgePrices, edgeThickness, edgeDecor, facadeCustomType, facadeCategory,
        facadeMilling, facadeThicknessOverride, addedProducts, addedServices, serviceData,
        currentProjectId, currentProjectName, mergedMaterials, furnitureType, checklistRefused
      };
      localStorage.setItem('mebcalc_draft', JSON.stringify(draftState));
    }
  }, [
    results, selectedDecor, prices, facadeType, sheetConfigs,
    trimming, kerf, rotations, cuttingType, calcMode, edgeToEdge,
    edgePrices, edgeThickness, edgeDecor, facadeCustomType, facadeCategory,
    facadeMilling, facadeThicknessOverride, addedProducts, addedServices, serviceData,
    currentProjectId, currentProjectName, furnitureType, checklistRefused
  ]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      delimiter: ';',
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as string[][];
        const parsedDetails: Detail[] = data.map(row => {
          const name = row[0] || '';
          const height = parseFloat(row[1]) || 0;
          const edgeProc = (row[2] || '').trim();
          const width = parseFloat(row[3]) || 0;
          const thickness = parseFloat(row[5]) || 0;
          const qty = parseFloat(row[6]) || 0;
          const color = row[7] || '';

          let type = '';
          if (name.includes('Фасад')) type = 'Фасад';
          else if (name.includes('ЛДСП') || name.includes('ДСП')) type = 'ЛДСП';
          else if (name.includes('МДФ')) type = 'МДФ';
          else if (name.includes('ДВП') || name.includes('ХДФ')) type = 'ХДФ';

          const area = (height * width) / 1000000;
          
          // Edge parsing logic
          const getEdgeSides = (proc: string, t: string) => {
            const sides = { top: false, bottom: false, left: false, right: false };
            if (t === 'ХДФ') return sides;
            const s = proc.trim();
            if (s === '=') return { top: true, bottom: true, left: true, right: true };
            if (!s || s === '.') return sides;

            // Heuristic for symbols often used in cutting list exports
            if (s.includes('||')) { sides.left = true; sides.right = true; }
            else if (s.includes('|')) { sides.left = true; }
            
            if (s.includes('--') || s.includes('==')) { sides.top = true; sides.bottom = true; }
            else if (s.includes('-')) { sides.top = true; }
            
            // Fallback: if non-empty and not matching above, assume 1 height and 1 width as per previous logic
            if (s && !sides.top && !sides.bottom && !sides.left && !sides.right) {
              sides.left = true;
              sides.top = true;
            }
            return sides;
          };

          const edgeSides = getEdgeSides(edgeProc, type);
          const edgeLength = (
            (edgeSides.top ? width : 0) + 
            (edgeSides.bottom ? width : 0) + 
            (edgeSides.left ? height : 0) + 
            (edgeSides.right ? height : 0)
          ) / 1000;

          return { type, name, height, edgeProc, width, thickness, qty, color, area, edgeLength, edgeSides };
        }).filter(d => d.type !== '');

        const grouped: any = {};
        const initialSheetConfigs: Record<string, SheetConfig> = {};
        const initialExpanded: Set<string> = new Set();

        parsedDetails.forEach(d => {
          const key = d.type === 'Фасад' 
            ? `${d.type}|${d.color}|${d.thickness}` 
            : `${d.type}|${d.name}|${d.color}|${d.thickness}`;
            
          if (!grouped[key]) {
            grouped[key] = { 
              type: d.type, 
              name: d.type === 'Фасад' ? 'Фасады' : d.name, 
              color: d.color, 
              thickness: d.thickness, 
              area: 0, 
              edgeLength: 0, 
              details: [] 
            };
            if (d.type === 'ХДФ' || d.type === 'ЛДСП' || d.type === 'МДФ') {
              // Try to guess brand from color/name for sheet config
              const configToUse = (productionFormat === 'contract' && productionSettings?.production) 
                ? productionSettings.production 
                : ownProductionConfig;
              
              const customBrand = configToUse?.ldspBrands?.find((b: any) => 
                d.color.toLowerCase().includes(b.brand.toLowerCase()) ||
                d.name.toLowerCase().includes(b.brand.toLowerCase())
              );
              
              if (customBrand && customBrand.format) {
                const [w, h] = customBrand.format.split('x').map((n: string) => parseInt(n));
                if (w && h) {
                  initialSheetConfigs[key] = { width: w, height: h };
                }
              }

              if (!initialSheetConfigs[key]) {
                const brandMatch = LDSP_BRANDS.find(b => 
                  d.color.toLowerCase().includes(b.name.split(' ')[0].toLowerCase()) ||
                  d.name.toLowerCase().includes(b.name.split(' ')[0].toLowerCase())
                );
                initialSheetConfigs[key] = brandMatch ? { width: brandMatch.width, height: brandMatch.height } : { width: 2800, height: 2070 };
              }
              initialExpanded.add(key);
            }
          }
          grouped[key].area += d.area * d.qty;
          grouped[key].edgeLength += d.edgeLength * d.qty;
          for(let i=0; i<d.qty; i++) {
            grouped[key].details.push({ ...d, rotated: false });
          }
        });

        setSheetConfigs(prev => ({ ...prev, ...initialSheetConfigs }));
        setExpandedResults(prev => new Set([...prev, ...initialExpanded]));
        setResults(grouped);
        setActiveTab('calculator');
      }
    });
  };

  const updateSheetConfig = (key: string, brand: SheetConfig) => {
    setSheetConfigs(prev => ({ ...prev, [key]: brand }));
  };

  const [manufacturerCoefficients, setManufacturerCoefficients] = useState<any>(null);

  // Sync Manufacturer Coefficients for Salons
  useEffect(() => {
    if (productionFormat === 'contract' && companyData?.manufacturerId) {
      const unsub = onSnapshot(doc(db, 'companies', companyData.manufacturerId, 'settings', 'production'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const isSpecial = data.specialConditionIds?.includes(companyData.id);
          
          if (isSpecial && data.salonCoefficients && data.salonCoefficients[companyData.id]) {
            setManufacturerCoefficients(data.salonCoefficients[companyData.id]);
          } else if (data.standardCoefficients) {
            setManufacturerCoefficients(data.standardCoefficients);
          } else {
            setManufacturerCoefficients(null);
          }
        }
      }, (error) => handleFirestoreError(error, OperationType.GET, `companies/${companyData?.manufacturerId}/settings/production`));
      return unsub;
    } else {
      setManufacturerCoefficients(null);
    }
  }, [productionFormat, companyData?.manufacturerId, companyData?.id]);

  const currentCoefficients = useMemo(() => {
    const defaultCoeffs = {
      ldsp: 1,
      hdf: 1,
      edge: 1,
      facadeSheet: 1,
      facadeCustom: 1,
      hardware: 1,
      assembly: 1,
      delivery: 1,
      products: INITIAL_PRODUCT_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: 1 }), {} as Record<string, number>)
    };

    // Factor in manufacturer coefficients if in contract mode
    let baseCoeffs = { ...defaultCoeffs };
    if (productionFormat === 'contract' && manufacturerCoefficients) {
      // Map factory coefficients
      baseCoeffs = {
        ...baseCoeffs,
        ...manufacturerCoefficients,
        products: { ...baseCoeffs.products }
      };
      
      // Map products
      Object.entries(manufacturerCoefficients).forEach(([key, val]) => {
        if (key.startsWith('cat_')) {
          baseCoeffs.products[key.replace('cat_', '')] = val as number;
        }
      });
    }

    // Now apply local (salon/designer) markups over the base (factory or default) prices
    if (!coefficients || !coefficients[customerType]) return baseCoeffs;
    
    let myMarkup = coefficients[customerType] as any;
    
    // If we are a production and viewing as a Salon (wholesale), use standardCoefficients
    if (customerType === 'wholesale' && companyData?.type === 'Мебельное производство' && ownProductionConfig.standardCoefficients) {
      myMarkup = ownProductionConfig.standardCoefficients as any;
    }

    const result = {
      ...baseCoeffs,
      ldsp: (baseCoeffs.ldsp || 1) * (myMarkup.ldsp || 1),
      hdf: (baseCoeffs.hdf || 1) * (myMarkup.hdf || 1),
      edge: (baseCoeffs.edge || 1) * (myMarkup.edge || 1),
      facadeSheet: (baseCoeffs.facadeSheet || 1) * (myMarkup.facadeSheet || 1),
      facadeCustom: (baseCoeffs.facadeCustom || 1) * (myMarkup.facadeCustom || 1),
      hardware: (baseCoeffs.hardware || 1) * (myMarkup.hardware || 1),
      assembly: (baseCoeffs.assembly || 1) * (myMarkup.assembly || 1),
      delivery: (baseCoeffs.delivery || 1) * (myMarkup.delivery || 1),
      products: { ...baseCoeffs.products }
    };

    // Multiply product categories
    Object.entries(baseCoeffs.products).forEach(([cat, baseVal]) => {
      const markupVal = myMarkup.products?.[cat] || 1;
      result.products[cat] = baseVal * markupVal;
    });

    return result;
  }, [coefficients, customerType, productionFormat, manufacturerCoefficients]);

  const totalCostForService = useMemo(() => {
    if (!results) return 0;
    
    // Helper to get config
    const configToUse = (productionFormat === 'contract' && productionSettings?.production) 
      ? productionSettings.production 
      : ownProductionConfig;

    let total = 0;
    Object.entries(results).forEach(([key, item]: any) => {
      const decor = selectedDecor[key];
      const basePriceKey = typeof decor === 'string' ? decor.replace(' ', '|') : '';
      const isManualMaterial = basePriceKey ? (!configToUse.prices?.[basePriceKey] || configToUse.prices?.[basePriceKey] === 0) : true;
      const priceKey = isManualMaterial ? `manual_${key}` : basePriceKey;
      const price = prices[priceKey] || 0;
      
      const isSheetFacade = item.type === 'Фасад' && (facadeType[key] || 'sheet') === 'sheet';
      const isCustomFacade = item.type === 'Фасад' && facadeType[key] === 'custom';

      let coef = 1;
      if (item.type === 'ЛДСП' || item.type === 'МДФ') coef = currentCoefficients.ldsp;
      else if (item.type === 'ХДФ') coef = currentCoefficients.hdf;
      else if (isSheetFacade) coef = currentCoefficients.facadeSheet;
      else if (isCustomFacade) coef = currentCoefficients.facadeCustom || 1.5;

      if (isCustomFacade) {
        total += item.area * price * coef;
      } else {
        const sheetW = (sheetConfigs[key]?.width || 2800) - (trimming * 2);
        const sheetH = (sheetConfigs[key]?.height || 2070) - (trimming * 2);
        const sheets = packDetails(item.details, sheetW, sheetH, kerf, rotations[key] || false, cuttingType);
        const sheetCount = sheets.length;
        const sheetArea = (sheetConfigs[key]?.width || 2800) * (sheetConfigs[key]?.height || 2070) / 1000000;
        
        if (calcMode === 'area') {
          total += sheetCount * sheetArea * price * coef;
        } else {
          total += sheetCount * price * coef;
        }
      }
    });

    addedProducts.forEach(p => total += p.price * p.quantity);
    addedServices.forEach(s => {
      const p = s.price !== undefined ? s.price : (prices[s.name] || 0);
      total += p * s.quantity;
    });

    return total;
  }, [results, selectedDecor, prices, facadeType, sheetConfigs, trimming, kerf, rotations, cuttingType, calcMode, currentCoefficients, addedProducts, addedServices]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Загрузка системы...</p>
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] border border-red-100 shadow-2xl shadow-red-100 text-center">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-4">Доступ заблокирован</h1>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Ваш аккаунт или компания были заблокированы администратором системы. Пожалуйста, свяжитесь с поддержкой для выяснения причин.
          </p>
          <button 
            onClick={handleLogout}
            className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 transition-all"
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authMode === 'landing') {
      return (
        <LandingPage 
          onLogin={() => setAuthMode('login')} 
          onRegister={() => setAuthMode('register')} 
        />
      );
    }
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Calculator className="text-white w-6 h-6" />
            </div>
            <span className="text-xl font-black text-gray-900 tracking-tight hidden sm:inline">Мебельный <span className="text-blue-600">калькулятор</span></span>
            <span className="text-xl font-black text-gray-900 tracking-tight sm:hidden">Калькулятор</span>
          </div>
          
          {authMode === 'login' ? (
            <LoginForm 
              onLogin={handleLogin} 
              onGoToRegister={() => setAuthMode('register')} 
            />
          ) : (
            <RegistrationForm 
              onRegister={handleRegister} 
              onGoToLogin={() => setAuthMode('login')} 
            />
          )}
          
          <button 
            onClick={() => setAuthMode('landing')}
            className="mt-8 w-full text-center text-sm font-bold text-gray-400 hover:text-blue-600 transition-colors"
          >
            ← Вернуться на главную
          </button>
        </div>
      </div>
    );
  }

  if (isAppAdmin && showAdminPanel) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <aside className={cn(
          "fixed inset-y-0 left-0 bg-white border-r border-gray-100 z-50 transition-all duration-300",
          isSidebarOpen ? "w-64" : "w-20"
        )}>
          <div className="flex flex-col h-full">
            <div className="p-6 flex items-center justify-between">
              {isSidebarOpen && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <ShieldCheck className="text-white w-5 h-5" />
                  </div>
                  <span className="font-black text-gray-900 tracking-tight">App <span className="text-blue-600">Admin</span></span>
                </div>
              )}
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-2">
              <button 
                onClick={() => setActiveTab('calculator')}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                  activeTab === 'calculator' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <LayoutDashboard className="w-6 h-6 flex-shrink-0" />
                {isSidebarOpen && <span className="font-medium">Панель управления</span>}
              </button>
            </nav>

            <div className="p-4 border-t border-gray-100">
              {companyData && (
                <button 
                  onClick={() => setShowAdminPanel(false)}
                  className="w-full flex items-center gap-4 p-3 rounded-xl text-blue-600 hover:bg-blue-50 transition-all mb-4"
                >
                  <Calculator className="w-6 h-6 flex-shrink-0" />
                  {isSidebarOpen && <span className="font-bold">Приложение</span>}
                </button>
              )}
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-4 p-3 rounded-xl text-red-600 hover:bg-red-50 transition-all font-bold"
              >
                <LogOut className="w-6 h-6 flex-shrink-0" />
                {isSidebarOpen && <span>Выйти</span>}
              </button>
            </div>
          </div>
        </aside>

        <main className={cn(
          "flex-1 transition-all duration-300",
          isSidebarOpen ? "lg:ml-64" : "lg:ml-20"
        )}>
          <AppAdminView />
        </main>
      </div>
    );
  }

  return (
    <>
      {/* Manufacturer Coefficients Modal */}
      {showManufacturerCoeffs && manufacturerCoefficients && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-gray-100">
            <div className="p-10 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
              <div>
                <h3 className="text-3xl font-black text-gray-900 leading-none mb-3">Коэффициенты производства</h3>
                <p className="text-gray-500 font-medium">
                  Параметры, установленные производством <span className="text-blue-600 font-bold">{allCompanies.find(c => c.id === companyData?.manufacturerId)?.name || '...'}</span> для вашего аккаунта.
                </p>
              </div>
              <button 
                onClick={() => setShowManufacturerCoeffs(false)}
                className="p-4 hover:bg-white rounded-[1.5rem] transition-all text-gray-400 hover:text-gray-900 shadow-sm hover:shadow active:scale-95"
              >
                <X className="w-7 h-7" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(manufacturerCoefficients).filter(([key]) => !key.startsWith('specialConditionIds')).map(([key, value]) => (
                  <div key={key} className="p-5 bg-gray-50 rounded-[1.5rem] border border-gray-100 flex items-center justify-between group hover:border-blue-200 transition-colors">
                    <span className="text-xs font-black text-gray-400 uppercase tracking-[0.1em] group-hover:text-blue-500 transition-colors">
                      {key === 'ldsp' ? 'ЛДСП / МДФ' : 
                       key === 'hdf' ? 'ХДФ' : 
                       key === 'edge' ? 'Кромка' : 
                       key === 'facadeSheet' ? 'Фасад (плита)' : 
                       key === 'facadeCustom' ? 'Фасад (заказной)' : 
                       key === 'hardware' ? 'Фурнитура' : 
                       key === 'assembly' ? 'Сборка' : 
                       key === 'delivery' ? 'Доставка' : 
                       key.startsWith('cat_') ? key.replace('cat_', '') : key}
                    </span>
                    <span className="text-2xl font-black text-gray-900">x{value as number}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-10 bg-gray-50 border-t border-gray-100">
              <button 
                onClick={() => setShowManufacturerCoeffs(false)}
                className="w-full py-5 bg-gray-900 text-white rounded-[1.5rem] font-bold hover:bg-black transition-all shadow-xl shadow-gray-200 active:scale-[0.98]"
              >
                Закрыть окно
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-screen bg-gray-50">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/20 z-40 lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transition-all duration-300 shadow-xl lg:shadow-none",
        isSidebarOpen ? "w-64" : "w-14 lg:w-20"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-4 flex items-center justify-between min-w-0 flex-shrink-0 border-b border-gray-100">
            {isSidebarOpen && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-lg text-blue-600 truncate leading-tight">Калькулятор</span>
                {companyData?.name && (
                  <span className="text-[9px] text-gray-400 truncate font-semibold uppercase tracking-wider">
                    {companyData.name}
                  </span>
                )}
              </div>
            )}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors ml-auto text-gray-400"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5 text-gray-600" />}
            </button>
          </div>

          <nav className="flex-1 px-3 py-3 space-y-1">
            <button 
              onClick={() => setActiveTab('projects')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                activeTab === 'projects' ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <FolderOpen className="w-5 h-5 flex-shrink-0" />
              {isSidebarOpen && <span className="text-sm font-medium">Проекты</span>}
            </button>
            <button 
              onClick={() => setActiveTab('calculator')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                activeTab === 'calculator' ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Calculator className="w-5 h-5 flex-shrink-0" />
              {isSidebarOpen && <span className="text-sm font-medium">Калькулятор</span>}
            </button>
            <button 
              onClick={() => setActiveTab('summary')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                activeTab === 'summary' ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
              {isSidebarOpen && <span className="text-sm font-medium">Итоговый расчет</span>}
            </button>
            <button 
              onClick={() => setActiveTab('products')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                activeTab === 'products' ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <ShoppingBag className="w-5 h-5 flex-shrink-0" />
              {isSidebarOpen && <span className="text-sm font-medium">Товары</span>}
            </button>
            <button 
              onClick={() => setActiveTab('services')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                activeTab === 'services' ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Database className="w-5 h-5 flex-shrink-0" />
              {isSidebarOpen && <span className="text-sm font-medium">Услуги</span>}
            </button>
            <button 
              onClick={() => setActiveTab('service-section')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                activeTab === 'service-section' ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Truck className="w-5 h-5 flex-shrink-0" />
              {isSidebarOpen && <span className="text-sm font-medium">Сервис</span>}
            </button>
          </nav>
          
          {/* BOTTOM PROFILE & ADMIN SECTION */}
          <div className="px-3 pb-3 pt-2 bg-gray-50/50 space-y-1">
            {isSidebarOpen && (
              <div className="mb-2">
                <div className="flex flex-col px-3 gap-0.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Профиль</span>
                  <span className="text-[13px] font-bold text-gray-900 truncate leading-tight">
                    {userData?.displayName || userData?.name || 'Пользователь'}
                  </span>
                  <span className="text-[9px] text-gray-500 font-medium truncate uppercase tracking-tighter">
                    {userRole === 'admin' ? 'Администратор' : 'Сотрудник'} {companyData?.type === 'Салон' ? 'салона' : (companyData?.type === 'Дизайнер' ? 'дизайнера' : '')}
                  </span>
                </div>
              </div>
            )}
            {userRole === 'admin' && (
              <>
                <button 
                  onClick={() => setActiveTab('price')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                    activeTab === 'price' ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <Tag className="w-[18px] h-[18px] flex-shrink-0" />
                  {isSidebarOpen && <span className="text-[13px] font-medium">Прайс-лист</span>}
                </button>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                    activeTab === 'settings' ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <Settings className="w-[18px] h-[18px] flex-shrink-0" />
                  {isSidebarOpen && <span className="text-[13px] font-medium">Настройки</span>}
                </button>
                <button 
                  onClick={() => setActiveTab('production')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                    activeTab === 'production' ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <Factory className="w-[18px] h-[18px] flex-shrink-0" />
                  {isSidebarOpen && <span className="text-[13px] font-medium">Производство</span>}
                </button>
              </>
            )}
            {userRole === 'admin' && (
              <button 
                onClick={() => setActiveTab('employees')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                  activeTab === 'employees' ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <Users className="w-[18px] h-[18px] flex-shrink-0" />
                {isSidebarOpen && <span className="text-[13px] font-medium">Сотрудники</span>}
              </button>
            )}
            {isAppAdmin && (
              <button 
                onClick={() => setShowAdminPanel(true)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-all border border-blue-100"
              >
                <ShieldCheck className="w-[18px] h-[18px] flex-shrink-0" />
                {isSidebarOpen && <span className="text-[13px] font-bold">Админ-панель</span>}
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
              {isSidebarOpen && <span className="text-[13px] font-medium">Выйти</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300 min-w-0",
        isSidebarOpen ? "ml-14 lg:ml-64" : "ml-14 lg:ml-20"
      )}>
        {activeTab === 'calculator' ? (
          <CalculatorView 
            handleFileUpload={handleFileUpload}
            handleCuttingTypeChange={handleCuttingTypeChange}
            cuttingType={cuttingType}
            kerf={kerf}
            setKerf={setKerf}
            results={results}
            selectedDecor={selectedDecor}
            setSelectedDecor={setSelectedDecor}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filteredDecors={filteredDecors}
            updateSheetConfig={updateSheetConfig}
            setEdgeDecor={setEdgeDecor}
            facadeType={facadeType}
            setFacadeType={setFacadeType}
            facadeSearchQuery={facadeSearchQuery}
            setFacadeSearchQuery={setFacadeSearchQuery}
            filteredFacadeDecors={filteredFacadeDecors}
            edgeDecor={edgeDecor}
            edgeToEdge={edgeToEdge}
            toggleEdgeToEdge={toggleEdgeToEdge}
            expandedResults={expandedResults}
            toggleExpanded={toggleExpanded}
            sheetConfigs={sheetConfigs}
            trimming={trimming}
            rotations={rotations}
            toggleRotation={toggleRotation}
            edgeThickness={edgeThickness}
            setEdgeThickness={setEdgeThickness}
            facadeCustomType={facadeCustomType}
            setFacadeCustomType={setFacadeCustomType}
            facadeCategory={facadeCategory}
            setFacadeCategory={setFacadeCategory}
            facadeMilling={facadeMilling}
            setFacadeMilling={setFacadeMilling}
            facadeThicknessOverride={facadeThicknessOverride}
            setFacadeThicknessOverride={setFacadeThicknessOverride}
            filteredHdfDecors={filteredHdfDecors}
            onSaveProject={saveProject}
            currentProjectId={currentProjectId}
            currentProjectName={currentProjectName}
            onNewProject={handleNewProject}
            showPrompt={showPrompt}
            showConfirm={showConfirm}
            productionFormat={productionFormat}
            productionSettings={productionSettings}
            ownProductionConfig={ownProductionConfig}
            mergedMaterials={mergedMaterials}
            setMergedMaterials={setMergedMaterials}
            isGluingMode={isGluingMode}
            setIsGluingMode={setIsGluingMode}
            selectedForGlue={selectedForGlue}
            setSelectedForGlue={setSelectedForGlue}
          />
        ) : activeTab === 'summary' ? (
          <SummaryView 
            results={results}
            selectedDecor={selectedDecor}
            prices={prices}
            facadeType={facadeType}
            sheetConfigs={sheetConfigs}
            trimming={trimming}
            kerf={kerf}
            rotations={rotations}
            cuttingType={cuttingType}
            calcMode={calcMode}
            coefficients={currentCoefficients}
            edgeToEdge={edgeToEdge}
            edgePrices={edgePrices}
            setEdgePrices={setEdgePrices}
            edgeThickness={edgeThickness}
            edgeDecor={edgeDecor}
            facadeCustomType={facadeCustomType}
            facadeCategory={facadeCategory}
            facadeMilling={facadeMilling}
            facadeThicknessOverride={facadeThicknessOverride}
            hardwareKitPrice={currentHardwareKitPrice}
            addedProducts={addedProducts}
            addedServices={addedServices}
            serviceData={serviceData}
            assemblyPercentage={assemblyPercentage}
            deliveryTariffs={deliveryTariffs}
            canEditCabinet={canEditCabinet}
            canEditFacades={canEditFacades}
            canEditHardware={canEditHardware}
            canEditAssembly={canEditAssembly}
            canEditDelivery={canEditDelivery}
            customerType={customerType}
            setCustomerType={setCustomerType}
            isProduction={companyData?.type === 'Мебельное производство'}
            ownProductionConfig={ownProductionConfig}
            productionFormat={productionFormat}
            productionSettings={productionSettings}
            userRole={userRole}
            companyType={companyData?.type}
            setPrices={setPrices}
            mergedMaterials={mergedMaterials}
            selectedForGlue={selectedForGlue}
            furnitureType={furnitureType}
            setFurnitureType={setFurnitureType}
            checklistRefused={checklistRefused}
            setChecklistRefused={setChecklistRefused}
          />
        ) : activeTab === 'projects' ? (
          <ProjectsView 
            companyId={companyData?.id}
            userId={userData?.uid}
            userRole={userRole}
            onLoadProject={loadProject}
            onOpenSpecification={(project) => {
              setSelectedProjectForSpec(project);
              setActiveTab('specification');
            }}
            companyType={companyData?.type}
            manufacturerId={companyData?.manufacturerId}
            showConfirm={showConfirm}
          />
        ) : activeTab === 'products' ? (
          <ProductsView 
            onAddProduct={onAddProduct} 
            catalogProducts={catalogProducts}
            productCategories={productCategories}
            setProductCategories={setProductCategories}
            coefficients={currentCoefficients}
            productionFormat={productionFormat}
            onSaveProduct={saveProduct}
            onDeleteProduct={deleteProduct}
            userRole={userRole}
            companyType={companyData?.type}
            furnitureType={furnitureType}
            setFurnitureType={setFurnitureType}
            checklistRefused={checklistRefused}
            setChecklistRefused={setChecklistRefused}
            addedProducts={addedProducts}
          />
        ) : activeTab === 'services' ? (
          <ServicesView 
            onAddService={onAddService} 
            prices={prices} 
            catalogServices={catalogServices}
            setCatalogServices={setCatalogServices}
          />
        ) : activeTab === 'service-section' ? (
          <ServiceSectionView 
            data={serviceData} 
            setData={setServiceData} 
            mapLink={mapLink}
            productionSettings={productionSettings}
            productionFormat={productionFormat}
            totalCost={totalCostForService}
            assemblyPercentage={assemblyPercentage}
            deliveryTariffs={deliveryTariffs}
            totalLdspSheets={Object.entries(results || {}).reduce((sum, [key, item]: any) => {
              if (item.type === 'ЛДСП' || item.type === 'МДФ') {
                const sheetW = (sheetConfigs[key]?.width || 2800) - (trimming * 2);
                const sheetH = (sheetConfigs[key]?.height || 2070) - (trimming * 2);
                const sheets = packDetails(item.details, sheetW, sheetH, kerf, rotations[key] || false, cuttingType);
                return sum + sheets.length;
              }
              return sum;
            }, 0)}
          />
        ) : activeTab === 'price' && (userRole === 'admin' || userRole === 'manager') ? (
          <PriceView 
            calcMode={calcMode}
            prices={prices}
            setPrices={setPrices}
            canEditCabinet={canEditCabinet}
            canEditFacades={canEditFacades}
            catalogServices={catalogServices}
            productionSettings={productionSettings}
            productionFormat={productionFormat}
            isProduction={companyData?.type === 'Мебельное производство'}
          />
        ) : activeTab === 'production' && userRole === 'admin' ? (
          <ProductionView 
            productionFormat={productionFormat}
            setProductionFormat={setProductionFormat}
            contractConfig={contractConfig}
            setContractConfig={setContractConfig}
            ownProductionConfig={ownProductionConfig}
            setOwnProductionConfig={setOwnProductionConfig}
            companyType={companyData?.type}
            companyId={companyData?.id}
            onSaveConfig={saveProductionConfig}
            showPrompt={showPrompt}
            productCategories={productCategories}
            allCompanies={allCompanies}
            manufacturerCoefficients={manufacturerCoefficients}
            setShowManufacturerCoeffs={setShowManufacturerCoeffs}
            isGluingMode={isGluingMode}
            setIsGluingMode={setIsGluingMode}
            selectedForGlue={selectedForGlue}
            setSelectedForGlue={setSelectedForGlue}
            sheetConfigs={sheetConfigs}
          />
        ) : activeTab === 'employees' ? (
          <AdminSettingsView 
            companyId={companyData?.id} 
            currentUserId={userData?.uid}
            showAlert={showAlert}
            showConfirm={showConfirm}
            showPrompt={showPrompt}
          />
        ) : activeTab === 'settings' && userRole === 'admin' ? (
          <SettingsView 
            coefficients={coefficients}
            setCoefficients={setCoefficients}
            calcMode={calcMode}
            setCalcMode={setCalcMode}
            trimming={trimming}
            setTrimming={setTrimming}
            defaultCuttingType={defaultCuttingType}
            setDefaultCuttingType={setDefaultCuttingType}
            hardwareKitPrice={hardwareKitPrice}
            setHardwareKitPrice={setHardwareKitPrice}
            assemblyPercentage={assemblyPercentage}
            setAssemblyPercentage={setAssemblyPercentage}
            deliveryTariffs={deliveryTariffs}
            setDeliveryTariffs={setDeliveryTariffs}
            mapLink={mapLink}
            setMapLink={setMapLink}
            canEditCabinet={canEditCabinet}
            canEditFacades={canEditFacades}
            canEditHardware={canEditHardware}
            canEditAssembly={canEditAssembly}
            canEditDelivery={canEditDelivery}
            productCategories={productCategories}
            setProductCategories={setProductCategories}
            productionFormat={productionFormat}
            productionSettings={productionSettings}
            companyType={companyData?.type}
            onSaveSettings={saveGeneralSettings}
            salonsUsingMe={salonsUsingMe}
            salonsInTable={salonsInTable}
            toggleSpecialCondition={toggleSpecialCondition}
            updateStandardCoefficient={updateStandardCoefficient}
            updateSalonCoefficient={updateSalonCoefficient}
            ownProductionConfig={ownProductionConfig}
            companyInfo={companyInfo}
            setCompanyInfo={setCompanyInfo}
          />
        ) : activeTab === 'specification' && selectedProjectForSpec ? (
          <ProjectSpecificationView 
            project={selectedProjectForSpec}
            onClose={() => setActiveTab('projects')}
            userRole={userRole || 'worker'}
            companyId={companyData?.id || ''}
            manufacturerId={companyData?.manufacturerId}
          />
        ) : (
          <CalculatorView 
            handleFileUpload={handleFileUpload}
            handleCuttingTypeChange={handleCuttingTypeChange}
            cuttingType={cuttingType}
            kerf={kerf}
            setKerf={setKerf}
            results={results}
            selectedDecor={selectedDecor}
            setSelectedDecor={setSelectedDecor}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filteredDecors={filteredDecors}
            updateSheetConfig={updateSheetConfig}
            setEdgeDecor={setEdgeDecor}
            facadeType={facadeType}
            setFacadeType={setFacadeType}
            facadeSearchQuery={facadeSearchQuery}
            setFacadeSearchQuery={setFacadeSearchQuery}
            filteredFacadeDecors={filteredFacadeDecors}
            edgeDecor={edgeDecor}
            edgeToEdge={edgeToEdge}
            toggleEdgeToEdge={toggleEdgeToEdge}
            expandedResults={expandedResults}
            toggleExpanded={toggleExpanded}
            sheetConfigs={sheetConfigs}
            trimming={trimming}
            rotations={rotations}
            toggleRotation={toggleRotation}
            edgeThickness={edgeThickness}
            setEdgeThickness={setEdgeThickness}
            facadeCustomType={facadeCustomType}
            setFacadeCustomType={setFacadeCustomType}
            facadeCategory={facadeCategory}
            setFacadeCategory={setFacadeCategory}
            facadeMilling={facadeMilling}
            setFacadeMilling={setFacadeMilling}
            facadeThicknessOverride={facadeThicknessOverride}
            setFacadeThicknessOverride={setFacadeThicknessOverride}
            filteredHdfDecors={filteredHdfDecors}
            onSaveProject={saveProject}
            currentProjectId={currentProjectId}
            currentProjectName={currentProjectName}
            onNewProject={handleNewProject}
            showPrompt={showPrompt}
            showConfirm={showConfirm}
            productionFormat={productionFormat}
            productionSettings={productionSettings}
            ownProductionConfig={ownProductionConfig}
            mergedMaterials={mergedMaterials}
            setMergedMaterials={setMergedMaterials}
            isGluingMode={isGluingMode}
            setIsGluingMode={setIsGluingMode}
            selectedForGlue={selectedForGlue}
            setSelectedForGlue={setSelectedForGlue}
          />
        )}
      </main>

      {/* Custom Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{modal.title}</h3>
              <p className="text-gray-500 mb-6">{modal.message}</p>
              
              {modal.type === 'prompt' && (
                <input 
                  type="text"
                  value={modal.value}
                  onChange={(e) => setModal({ ...modal, value: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none mb-6"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setModal({ ...modal, isOpen: false });
                      modal.onConfirm?.(modal.value);
                    }
                  }}
                />
              )}

              <div className="flex items-center justify-end gap-3">
                {(modal.type === 'confirm' || modal.type === 'prompt') && (
                  <button 
                    onClick={() => {
                      setModal({ ...modal, isOpen: false });
                      modal.onCancel?.();
                    }}
                    className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-all"
                  >
                    Отмена
                  </button>
                )}
                <button 
                  onClick={() => {
                    setModal({ ...modal, isOpen: false });
                    modal.onConfirm?.(modal.value);
                  }}
                  className="px-6 py-2.5 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                >
                  {modal.type === 'alert' ? 'ОК' : 'Подтвердить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offline Indicator */}
      {isOffline && (
        <div className="fixed bottom-6 right-6 z-[200] bg-red-50 text-red-600 px-6 py-3 rounded-2xl shadow-xl border border-red-100 flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300">
          <WifiOff className="w-5 h-5" />
          <div>
            <div className="text-sm font-bold">Оффлайн режим</div>
            <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">Данные сохраняются локально</div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
