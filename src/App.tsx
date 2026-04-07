import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { RegistrationForm, RegistrationData } from './components/Auth/RegistrationForm';
import { LoginForm } from './components/Auth/LoginForm';
import { AdminSettingsView } from './components/Admin/AdminSettingsView';
import { ProjectsView } from './components/Projects/ProjectsView';
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
  Minus,
  Factory,
  Users,
  LogOut,
  FolderOpen
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
import { LDSP_DATABASE, NORDECO_EDGE_MAPPING, PRICE_LIST_CATEGORIES, SERVICES_LIST } from './constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ProductionFormat = 'own' | 'contract';

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
  onSaveConfig
}: {
  productionFormat: ProductionFormat;
  setProductionFormat: React.Dispatch<React.SetStateAction<ProductionFormat>>;
  contractConfig: ContractConfig;
  setContractConfig: React.Dispatch<React.SetStateAction<ContractConfig>>;
  ownProductionConfig: OwnProductionConfig;
  setOwnProductionConfig: React.Dispatch<React.SetStateAction<OwnProductionConfig>>;
  companyType?: string;
  onSaveConfig: (config: OwnProductionConfig) => void;
}) => {
  const updateContractConfig = (key: keyof ContractConfig, field: keyof ContractServiceConfig, value: boolean) => {
    setContractConfig(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] as ContractServiceConfig),
        [field]: value
      }
    }));
  };

  // If company type is Мебельное производство, force own production
  React.useEffect(() => {
    if (companyType === 'Мебельное производство' && productionFormat !== 'own') {
      setProductionFormat('own');
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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Производство</h2>
        <p className="text-sm text-gray-500">Настройка формата работы калькулятора</p>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-8">
        {companyType !== 'Мебельное производство' && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">Формат работы калькулятора</label>
            <div className="flex flex-col sm:flex-row gap-4">
              <label className={cn(
                "flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                productionFormat === 'own' ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-blue-300"
              )}>
                <input 
                  type="radio" 
                  name="format" 
                  value="own" 
                  checked={productionFormat === 'own'}
                  onChange={() => setProductionFormat('own')}
                  className="w-5 h-5 text-blue-600"
                />
                <span className="font-bold text-gray-800">Собственное производство</span>
              </label>
              <label className={cn(
                "flex-1 flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                productionFormat === 'contract' ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-blue-300"
              )}>
                <input 
                  type="radio" 
                  name="format" 
                  value="contract" 
                  checked={productionFormat === 'contract'}
                  onChange={() => setProductionFormat('contract')}
                  className="w-5 h-5 text-blue-600"
                />
                <span className="font-bold text-gray-800">Контрактное производство</span>
              </label>
            </div>
          </div>
        )}

        {companyType === 'Мебельное производство' && (
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <div className="flex items-center gap-3 text-blue-800 font-medium">
              <Factory className="w-5 h-5" />
              <span>Режим собственного производства активирован</span>
            </div>
          </div>
        )}

        {productionFormat === 'own' && (
          <div className="space-y-8 pt-8 border-t border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-4">Данные производства</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Бренды ЛДСП и форматы листов</label>
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

                <div className="pt-6 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={() => onSaveConfig(ownProductionConfig)}
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Сохранить настройки
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Фотографии производства (до 10 шт)</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                        <Plus className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-medium text-gray-700">Нажмите для загрузки фотографий</p>
                      <p className="text-xs text-gray-500 mt-1">JPG, PNG до 5MB</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {productionFormat === 'contract' && (
          <div className="space-y-8 pt-8 border-t border-gray-100">
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
                  {contractConfig.city && PRODUCTIONS[contractConfig.city]?.map(prod => (
                    <option key={prod.id} value={prod.id}>{prod.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
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
  packedX?: number;
  packedY?: number;
  label?: string;
  rotated?: boolean;
}

interface SheetConfig {
  width: number;
  height: number;
}

interface DeliveryTariffs {
  basePrice: number;
  baseDistance: number;
  baseVolume: number;
  extraKmPrice: number;
  extraVolumePrice: number;
  extraLoaderPrice: number;
}

const LDSP_BRANDS = [
  { name: 'Kronospan (2800x2070)', width: 2800, height: 2070 },
  { name: 'Egger (2800x2070)', width: 2800, height: 2070 },
  { name: 'Lamarty (2750x1830)', width: 2750, height: 1830 },
  { name: 'Nordeco (2800x2070)', width: 2800, height: 2070 },
  { name: 'Uvadrev (2440x1830)', width: 2440, height: 1830 },
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
  catalogServices
}: { 
  calcMode: string; 
  prices: Record<string, number>; 
  setPrices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  canEditCabinet: boolean;
  canEditFacades: boolean;
  catalogServices: any[];
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
              placeholder="Поиск декора..." 
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
              "p-6 rounded-2xl border-2 transition-all text-left flex flex-col justify-between h-32 group",
              expandedCategories.has(cat.title) 
                ? "border-blue-500 bg-blue-50/50 shadow-md" 
                : "border-gray-100 bg-white hover:border-blue-200 hover:shadow-sm"
            )}
          >
            <div className="flex justify-between items-start">
              <span className={cn(
                "font-bold text-lg leading-tight",
                expandedCategories.has(cat.title) ? "text-blue-700" : "text-gray-700"
              )}>
                {cat.title}
              </span>
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                expandedCategories.has(cat.title) ? "bg-blue-100 text-blue-600" : "bg-gray-50 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500"
              )}>
                {expandedCategories.has(cat.title) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </div>
            </div>
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
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
                  const canEdit = (isCabinetCategory && canEditCabinet) || (isFacadeCategory && canEditFacades) || isServices;

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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {filtered.map(decor => {
                                const service = isServices ? catalogServices.find(s => s.name === decor) : null;
                                const unit = isServices ? service?.unit : (calcMode === 'area' ? 'м²' : 'лист');
                                const priceKey = isServices ? decor : `${brand}|${decor}`;
                                
                                return (
                                  <div key={decor} className="p-3 border border-gray-100 rounded-lg hover:border-blue-200 transition-colors group">
                                    <div className="text-sm font-medium text-gray-700 mb-2 truncate" title={decor}>{decor}</div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-400">Цена:</span>
                                      <input 
                                        type="number" 
                                        value={prices[priceKey] || ''}
                                        onChange={(e) => setPrices(prev => ({ ...prev, [priceKey]: parseFloat(e.target.value) }))}
                                        placeholder="0.00"
                                        disabled={!canEdit}
                                        className={cn(
                                          "w-full text-sm border-b border-gray-200 focus:border-blue-500 outline-none py-1 px-1",
                                          canEdit ? "group-hover:bg-blue-50/30" : "bg-gray-50 text-gray-500 cursor-not-allowed"
                                        )}
                                      />
                                      <span className="text-xs text-gray-400">₽/{unit}</span>
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
  onSaveProject
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
}) => {
  const [projectName, setProjectName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  const handleSave = () => {
    if (!projectName) return;
    onSaveProject(projectName);
    setShowSaveModal(false);
    setProjectName('');
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-8">
          <LayoutDashboard className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Мебельный калькулятор</h1>
        </div>
        
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
                onClick={() => setShowSaveModal(true)}
                className="px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 transition-all flex items-center gap-2"
              >
                <FolderOpen className="w-5 h-5" />
                Сохранить проект
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
                              placeholder="Поиск декора в базе..."
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
                                      const fullName = `${d.brand} ${d.name}`;
                                      setSelectedDecor(prev => ({ ...prev, [key]: fullName }));
                                      setSearchQuery('');
                                      
                                      // Auto set sheet config
                                      const brandConfig = LDSP_BRANDS.find(b => b.name.includes(d.brand));
                                      if (brandConfig) updateSheetConfig(key, brandConfig);
                                      
                                      // Auto set edge decor
                                      if (d.brand === 'Egger') {
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
                                    <span className="font-bold text-blue-600">{d.brand}</span> {d.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {item.type !== 'ХДФ' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Бренд плиты</label>
                            <select 
                              onChange={(e) => {
                                const brand = LDSP_BRANDS.find(b => b.name.includes(e.target.value));
                                if (brand) updateSheetConfig(key, brand);
                              }}
                              className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            >
                              <option value="">Выберите бренд...</option>
                              {LDSP_BRANDS.map(b => <option key={b.name} value={b.name}>{b.name.split(' ')[0]}</option>)}
                            </select>
                          </div>
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
                        </div>
                      )}
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
                                className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                              >
                                <option value="">Выберите бренд...</option>
                                {LDSP_BRANDS.map(b => <option key={b.name} value={b.name}>{b.name.split(' ')[0]}</option>)}
                                {Object.keys(FACADE_BRANDS).map(b => <option key={b} value={b}>{b}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Декор</label>
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input 
                                  type="text"
                                  placeholder="Поиск декора..."
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
                                          
                                          const brandConfig = LDSP_BRANDS.find(b => b.name.includes(d.brand)) || FACADE_BRANDS[d.brand];
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
                                  placeholder="Поиск декора..."
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
                                      <h4 className="font-bold text-gray-800">Лист {sheetIndex + 1}</h4>
                                    </div>
                                    <div className="flex items-center gap-6">
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
                                  <div className="border-4 border-gray-100 relative bg-gray-50 mx-auto rounded-lg overflow-hidden" style={{ width: '100%', maxWidth: '800px', aspectRatio: '1' }}>
                                    {sheet.map((d: Detail, i: number) => (
                                      <div key={i} className="bg-blue-100 border border-blue-300 text-[10px] p-1 absolute flex flex-col items-center justify-center overflow-hidden hover:bg-blue-200 transition-all cursor-help group" style={{ 
                                        left: `${((d.packedX! + trimming) / sheetConfigs[key].width) * 100}%`, 
                                        top: `${((d.packedY! + trimming) / sheetConfigs[key].height) * 100}%`, 
                                        width: `${(d.width / sheetConfigs[key].width) * 100}%`, 
                                        height: `${(d.height / sheetConfigs[key].height) * 100}%` 
                                      }}>
                                        <span className="font-bold text-blue-800 text-center leading-tight truncate w-full">{d.name}</span>
                                        <span className="text-blue-600 font-mono mt-0.5">{d.width}×{d.height}</span>
                                        
                                        {/* Tooltip */}
                                        <div className="absolute hidden group-hover:block bg-gray-900 text-white p-2 rounded shadow-xl z-10 w-max max-w-[200px] text-xs left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 pointer-events-none">
                                          <div className="font-bold mb-1 border-b border-gray-700 pb-1">{d.name}</div>
                                          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                            <span className="text-gray-400">Размер:</span>
                                            <span>{d.width} × {d.height}</span>
                                            <span className="text-gray-400">Кромка:</span>
                                            <span>{d.edgeLength.toFixed(2)} м</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
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

      {showSaveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Сохранить проект</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название проекта</label>
                <input 
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Например: Кухня Иванова"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Отмена
                </button>
                <button 
                  onClick={handleSave}
                  disabled={!projectName}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
  facadeCustomType,
  facadeCategory,
  facadeMilling,
  facadeThicknessOverride,
  hardwareKitPrice,
  addedProducts,
  addedServices,
  serviceData,
  assemblyPercentage,
  deliveryTariffs,
  canEditCabinet,
  canEditFacades,
  canEditHardware,
  canEditAssembly,
  canEditDelivery
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
}) => {
  if (!results && addedProducts.length === 0 && addedServices.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <Calculator className="w-12 h-12 mb-4" />
      <p>Загрузите файл отчета из Pro100 для получения итогового расчета</p>
    </div>
  );

  let totalCost = 0;
  let allDataEntered = true;
  let totalLdspSheets = 0;

  const summaryRows = results ? Object.entries(results).flatMap(([key, item]: any) => {
    const rows = [];
    
    // Material Row
    const decor = selectedDecor[key];
    const priceKey = decor ? decor.replace(' ', '|') : '';
    const price = prices[priceKey] || 0;
    
    const isCustomFacade = item.type === 'Фасад' && facadeType[key] === 'custom';
    const isSheetFacade = item.type === 'Фасад' && (facadeType[key] || 'sheet') === 'sheet';
    
    let itemCost = 0;
    let qtyText = '';
    let coef = 1;

    if (item.type === 'ЛДСП' || item.type === 'МДФ') coef = coefficients.ldsp;
    else if (item.type === 'ХДФ') coef = coefficients.hdf;
    else if (isSheetFacade) coef = coefficients.facadeSheet;
    
    // Override coefficient if user cannot edit it (meaning it's contract production and they are not calculating for clients)
    if ((item.type === 'ЛДСП' || item.type === 'МДФ') && !canEditCabinet) coef = coefficients.ldsp; // Assuming coefficients are pre-filled from contract
    if (item.type === 'ХДФ' && !canEditCabinet) coef = coefficients.hdf;
    if (item.type === 'Фасад' && isSheetFacade && !canEditFacades) coef = coefficients.facadeSheet;

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
        total: Math.round(itemCost),
        coef: 1
      });
    } else {
      const sheetW = (sheetConfigs[key]?.width || 2800) - (trimming * 2);
      const sheetH = (sheetConfigs[key]?.height || 2070) - (trimming * 2);
      const sheets = packDetails(item.details, sheetW, sheetH, kerf, rotations[key] || false, cuttingType);
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

      rows.push({
        type: 'material',
        name: item.name,
        sub: item.color,
        decor: decor || 'Не выбран',
        qty: qtyText,
        price: price,
        total: Math.round(itemCost),
        coef: coef
      });
    }
    
    if (price === 0) allDataEntered = false;

    // Edge Row
    if (item.type !== 'ХДФ' && (item.type !== 'Фасад' || isSheetFacade)) {
      const isFacade = item.type === 'Фасад';
      const edgeLen = (edgeToEdge[key] || isFacade)
        ? (item.details.reduce((sum: any, d: any) => sum + ((d.width + d.height) * 2), 0) / 1000)
        : item.edgeLength;
      const ePrice = edgePrices[key] || 0;
      let edgeCoef = coefficients.edge;
      if (!canEditCabinet) edgeCoef = coefficients.edge; // Assuming pre-filled

      const eCost = edgeLen * ePrice * edgeCoef;
      
      if (ePrice === 0) allDataEntered = false;

      rows.push({
        type: 'edge',
        name: `Кромка (${isFacade ? '1.0' : (edgeThickness[key] || '0.4')} мм)`,
        sub: edgeDecor[key] || 'Не указан',
        decor: edgeDecor[key] || 'Не указан',
        qty: `${edgeLen.toFixed(2)} м`,
        price: ePrice,
        total: Math.round(eCost),
        isEdge: true,
        key: key,
        coef: edgeCoef
      });
    }

    return rows;
  }) : [];

  // Add Hardware Kit Row
  if (totalLdspSheets > 0) {
    const kitCost = totalLdspSheets * hardwareKitPrice;
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
    summaryRows.push({
      type: 'service',
      name: service.name,
      sub: service.supplier ? `От поставщика: ${service.supplier}` : 'Услуги производства',
      decor: '-',
      qty: `${service.quantity} ${service.unit}`,
      price: price,
      total: price * service.quantity,
      coef: 1
    });
  });

  totalCost = summaryRows.reduce((sum, row) => sum + row.total, 0);

  // Add Assembly Fee if enabled
  if (serviceData.assembly) {
    const assemblyFee = Math.round(totalCost * (assemblyPercentage / 100));
    summaryRows.push({
      type: 'service',
      name: 'Базовый пакет сборки',
      sub: `Сервис (${assemblyPercentage}% от стоимости)`,
      decor: '-',
      qty: '1 усл',
      price: assemblyFee,
      total: assemblyFee,
      coef: 1
    });
    totalCost += assemblyFee;
  }

  // Add Delivery Fee if enabled
  if (serviceData.delivery) {
    let deliveryFee = deliveryTariffs.basePrice;
    
    if (serviceData.distance > deliveryTariffs.baseDistance) {
      deliveryFee += (serviceData.distance - deliveryTariffs.baseDistance) * deliveryTariffs.extraKmPrice;
    }

    // Calculate total volume (rough estimation based on sheets)
    const totalVolume = totalLdspSheets * 0.1; // Assuming 0.1m3 per sheet
    if (totalVolume > deliveryTariffs.baseVolume) {
      deliveryFee += (totalVolume - deliveryTariffs.baseVolume) * deliveryTariffs.extraVolumePrice;
    }

    if (serviceData.extraLoader) {
      deliveryFee += deliveryTariffs.extraLoaderPrice;
    }

    summaryRows.push({
      type: 'service',
      name: 'Доставка на объект',
      sub: `Сервис (${serviceData.distance} км${serviceData.extraLoader ? ', +1 грузчик' : ''})`,
      decor: '-',
      qty: '1 усл',
      price: deliveryFee,
      total: deliveryFee,
      coef: 1
    });
    totalCost += deliveryFee;
  }

  const finalTotal = allDataEntered ? Math.round(totalCost) : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Итоговый расчет проекта</h2>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Материал / Параметры</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Декор</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Кол-во</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Цена</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Итого</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {summaryRows.filter(r => r.type === 'material' || r.type === 'edge' || r.type === 'hardware').map((row, idx) => {
              const isMaterial = row.type === 'material';
              const isFirst = idx === 0;
              
              return (
                <tr key={idx} className={cn(
                  "hover:bg-gray-50 transition-colors", 
                  row.isEdge && "bg-gray-50/20",
                  isMaterial && !isFirst && "border-t border-gray-200/60"
                )}>
                  <td className="px-6 py-4">
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
                <td className="px-6 py-4">
                  <span className={cn(
                    "text-sm font-medium", 
                    row.decor === 'Не выбран' || row.decor === 'Не указан' ? "text-gray-400 italic" : "text-blue-600",
                    row.isEdge && "pl-6 text-xs text-gray-500 font-normal"
                  )}>
                    {row.decor}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-mono text-sm">
                  <span className={cn(row.isEdge && "text-xs text-gray-500")}>
                    {row.qty}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-mono text-sm">
                  {row.isEdge ? (
                    <div className="flex items-center justify-end gap-2">
                      <input 
                        type="number"
                        value={edgePrices[row.key!] || ''}
                        onChange={(e) => setEdgePrices(prev => ({ ...prev, [row.key!]: parseFloat(e.target.value) || 0 }))}
                        placeholder="0"
                        disabled={!canEditCabinet}
                        className={cn(
                          "w-20 p-1 border rounded text-right text-sm outline-none",
                          !canEditCabinet ? "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed" : "border-gray-200 focus:ring-1 focus:ring-blue-500"
                        )}
                      />
                      <span>₽</span>
                    </div>
                  ) : (
                    `${row.price.toLocaleString()} ₽`
                  )}
                </td>
                <td className="px-6 py-4 text-right font-bold text-gray-900">
                  <span className={cn(row.isEdge && "text-sm font-medium text-gray-600")}>
                    {row.total.toLocaleString()} ₽
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
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{row.name}</div>
                      <div className="text-xs text-gray-500">{row.sub}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-400">-</span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm">{row.qty}</td>
                    <td className="px-6 py-4 text-right font-mono text-sm">
                      {row.price.toLocaleString()} ₽
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">{row.total.toLocaleString()} ₽</td>
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
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{row.name}</div>
                      <div className="text-xs text-gray-500">{row.sub}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-400">-</span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-green-600">{row.qty}</td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-green-600">
                      {row.price.toLocaleString()} ₽
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-green-600">{row.total.toLocaleString()} ₽</td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-blue-50">
              <td colSpan={3} className="px-6 py-6 text-right font-bold text-gray-700 text-lg">Общая стоимость:</td>
              <td colSpan={2} className="px-6 py-6 text-right font-black text-blue-600 text-2xl">
                {finalTotal > 0 ? `${finalTotal.toLocaleString()} ₽` : '0 ₽'}
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
  onSaveSettings
}: { 
  coefficients: any; 
  setCoefficients: React.Dispatch<React.SetStateAction<any>>; 
  calcMode: 'sheet' | 'area'; 
  setCalcMode: React.Dispatch<React.SetStateAction<'sheet' | 'area'>>; 
  trimming: number; 
  setTrimming: React.Dispatch<React.SetStateAction<number>>; 
  defaultCuttingType: 'saw' | 'nesting'; 
  setDefaultCuttingType: React.Dispatch<React.SetStateAction<'saw' | 'nesting'>>; 
  hardwareKitPrice: number;
  setHardwareKitPrice: React.Dispatch<React.SetStateAction<number>>;
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
  onSaveSettings: () => void;
}) => {
  const [newCategory, setNewCategory] = useState('');

  const handleAddCategory = () => {
    if (newCategory && !productCategories.includes(newCategory)) {
      setProductCategories(prev => [...prev, newCategory]);
      setCoefficients(prev => ({
        ...prev,
        products: {
          ...prev.products,
          [newCategory]: 1.5
        }
      }));
      setNewCategory('');
    }
  };

  const handleRemoveCategory = (cat: string) => {
    setProductCategories(prev => prev.filter(c => c !== cat));
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-12">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-8">
        <section>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Общие настройки</h3>
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
                  onClick={() => setDefaultCuttingType('saw')}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                    defaultCuttingType === 'saw' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  Пила
                </button>
                <button 
                  onClick={() => setDefaultCuttingType('nesting')}
                  className={cn(
                    "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                    defaultCuttingType === 'nesting' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
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
                onChange={(e) => setTrimming(parseFloat(e.target.value) || 0)}
                className="w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Дополнительно</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="font-bold text-gray-700 block">Цена комплекта метизов</span>
                <span className="text-xs text-gray-500">На 1 лист ЛДСП</span>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  value={hardwareKitPrice}
                  onChange={(e) => setHardwareKitPrice(parseFloat(e.target.value) || 0)}
                  disabled={!canEditHardware}
                  className={cn(
                    "w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none",
                    !canEditHardware && "bg-gray-100 text-gray-500 cursor-not-allowed"
                  )}
                />
                <span className="text-sm text-gray-400 font-bold">₽</span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Коэффициенты наценки</h3>
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="font-bold text-gray-700 block">ЛДСП / МДФ</span>
                <span className="text-xs text-gray-500">Коэффициент на листы</span>
              </div>
              <input 
                type="number" 
                step="0.1"
                value={coefficients.ldsp}
                onChange={(e) => setCoefficients(prev => ({ ...prev, ldsp: parseFloat(e.target.value) || 0 }))}
                disabled={!canEditCabinet}
                className={cn(
                  "w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none",
                  !canEditCabinet && "bg-gray-100 text-gray-500 cursor-not-allowed"
                )}
              />
            </div>
            
            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="font-bold text-gray-700 block">ДВП / ХДФ</span>
                <span className="text-xs text-gray-500">Коэффициент на листы</span>
              </div>
              <input 
                type="number" 
                step="0.1"
                value={coefficients.hdf}
                onChange={(e) => setCoefficients(prev => ({ ...prev, hdf: parseFloat(e.target.value) || 0 }))}
                disabled={!canEditCabinet}
                className={cn(
                  "w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none",
                  !canEditCabinet && "bg-gray-100 text-gray-500 cursor-not-allowed"
                )}
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="font-bold text-gray-700 block">Кромка</span>
                <span className="text-xs text-gray-500">Коэффициент на метраж</span>
              </div>
              <input 
                type="number" 
                step="0.1"
                value={coefficients.edge}
                onChange={(e) => setCoefficients(prev => ({ ...prev, edge: parseFloat(e.target.value) || 0 }))}
                disabled={!canEditCabinet}
                className={cn(
                  "w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none",
                  !canEditCabinet && "bg-gray-100 text-gray-500 cursor-not-allowed"
                )}
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="font-bold text-gray-700 block">Фасады плитные</span>
                <span className="text-xs text-gray-500">Коэффициент на листы фасадов</span>
              </div>
              <input 
                type="number" 
                step="0.1"
                value={coefficients.facadeSheet}
                onChange={(e) => setCoefficients(prev => ({ ...prev, facadeSheet: parseFloat(e.target.value) || 0 }))}
                disabled={!canEditFacades}
                className={cn(
                  "w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none",
                  !canEditFacades && "bg-gray-100 text-gray-500 cursor-not-allowed"
                )}
              />
            </div>
          </div>
        </section>

        {productionFormat === 'own' && (
          <section>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Категории товаров и коэффициенты</h3>
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
              <div className="grid gap-4">
                {productCategories.map(cat => (
                  <div key={cat} className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="flex-1 flex items-center gap-2">
                      <button
                        onClick={() => handleRemoveCategory(cat)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="Удалить категорию"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <span className="font-bold text-gray-700 block">{cat}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Коэф.</span>
                      <input 
                        type="number" 
                        step="0.1"
                        value={coefficients.products?.[cat] || 1.5}
                        onChange={(e) => setCoefficients(prev => ({
                          ...prev,
                          products: {
                            ...prev.products,
                            [cat]: parseFloat(e.target.value) || 0
                          }
                        }))}
                        className="w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
        
        <section>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Сервисные услуги</h3>
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="font-bold text-gray-700 block">Процент сборки (%)</span>
                <span className="text-xs text-gray-500">От общей стоимости заказа</span>
              </div>
              <input 
                type="number" 
                value={assemblyPercentage}
                onChange={(e) => setAssemblyPercentage(parseFloat(e.target.value) || 0)}
                disabled={!canEditAssembly}
                className={cn(
                  "w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none",
                  !canEditAssembly && "bg-gray-100 text-gray-500 cursor-not-allowed"
                )}
              />
            </div>
            
            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="font-bold text-gray-700 block">Базовая стоимость доставки (₽)</span>
                <span className="text-xs text-gray-500">Минимальная стоимость машины</span>
              </div>
              <input 
                type="number" 
                value={deliveryTariffs.basePrice}
                onChange={(e) => setDeliveryTariffs(prev => ({ ...prev, basePrice: parseFloat(e.target.value) || 0 }))}
                disabled={!canEditDelivery}
                className={cn(
                  "w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none",
                  !canEditDelivery && "bg-gray-100 text-gray-500 cursor-not-allowed"
                )}
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="font-bold text-gray-700 block">Базовое расстояние (км)</span>
                <span className="text-xs text-gray-500">Включено в минимальную стоимость</span>
              </div>
              <input 
                type="number" 
                value={deliveryTariffs.baseDistance}
                onChange={(e) => setDeliveryTariffs(prev => ({ ...prev, baseDistance: parseFloat(e.target.value) || 0 }))}
                className="w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="font-bold text-gray-700 block">Доплата за перепробег (₽/км)</span>
                <span className="text-xs text-gray-500">Свыше базового расстояния</span>
              </div>
              <input 
                type="number" 
                value={deliveryTariffs.extraKmPrice}
                onChange={(e) => setDeliveryTariffs(prev => ({ ...prev, extraKmPrice: parseFloat(e.target.value) || 0 }))}
                className="w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="font-bold text-gray-700 block">Базовый объем (м²)</span>
                <span className="text-xs text-gray-500">Включено в минимальную стоимость</span>
              </div>
              <input 
                type="number" 
                value={deliveryTariffs.baseVolume}
                onChange={(e) => setDeliveryTariffs(prev => ({ ...prev, baseVolume: parseFloat(e.target.value) || 0 }))}
                className="w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="font-bold text-gray-700 block">Доплата за перегруз (₽/м²)</span>
                <span className="text-xs text-gray-500">Свыше базового объема</span>
              </div>
              <input 
                type="number" 
                value={deliveryTariffs.extraVolumePrice}
                onChange={(e) => setDeliveryTariffs(prev => ({ ...prev, extraVolumePrice: parseFloat(e.target.value) || 0 }))}
                className="w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="font-bold text-gray-700 block">Дополнительный грузчик (₽)</span>
                <span className="text-xs text-gray-500">Стоимость 1 грузчика</span>
              </div>
              <input 
                type="number" 
                value={deliveryTariffs.extraLoaderPrice}
                onChange={(e) => setDeliveryTariffs(prev => ({ ...prev, extraLoaderPrice: parseFloat(e.target.value) || 0 }))}
                className="w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
              <div>
                <span className="font-bold text-gray-700 block">Ссылка на карты</span>
                <span className="text-xs text-gray-500">Для расчета километража</span>
              </div>
              <input 
                type="text" 
                value={mapLink}
                onChange={(e) => setMapLink(e.target.value)}
                className="w-64 p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
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

const SAMPLE_PRODUCTS = [
  { id: 1, name: "Петля Sensys 8645i", category: "Петли", price: 250, description: "Петля со встроенным демпфером Silent System", image: "https://picsum.photos/seed/hinge/400/300" },
  { id: 2, name: "Ручка-скоба 128мм", category: "Ручки и крючки", price: 450, description: "Матовый черный металл, современный стиль", image: "https://picsum.photos/seed/handle/400/300" },
  { id: 3, name: "Тандембокс Antaro", category: "Системы выдвижения", price: 3500, description: "Система выдвижения с доводчиком, высота M", image: "https://picsum.photos/seed/drawer/400/300" },
  { id: 4, name: "Мойка GranFest Quarz", category: "Мойки и аксессуары", price: 8900, description: "Кварцевая мойка, цвет Песок", image: "https://picsum.photos/seed/sink/400/300" },
];

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

  const handleAdd = (service: any) => {
    const qty = quantities[service.id] || 1;
    onAddService(service, qty);
    setQuantities(prev => ({ ...prev, [service.id]: 1 }));
  };

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
        <p className="text-sm text-gray-500">Выберите необходимые услуги для выполнения проекта</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-8">
        <h3 className="font-bold text-gray-800 mb-4">Добавить свою услугу в каталог</h3>
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
            Каталог услуг пуст. Добавьте свои услуги выше.
          </div>
        ) : (
          catalogServices.map(service => {
            const price = service.price !== undefined ? service.price : (prices[service.name] || 0);
            return (
              <div key={service.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800">{service.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-gray-500">Ед. изм: {service.unit}</span>
                    <span className="text-sm font-bold text-blue-600">{price > 0 ? `${price.toLocaleString()} ₽` : 'Цена не указана'}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    <button 
                      onClick={() => setQuantities(prev => ({ ...prev, [service.id]: Math.max(1, (prev[service.id] || 1) - 1) }))}
                      className="p-2 hover:bg-gray-200 text-gray-600 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input 
                      type="number" 
                      value={quantities[service.id] || 1}
                      onChange={(e) => setQuantities(prev => ({ ...prev, [service.id]: parseInt(e.target.value) || 1 }))}
                      className="w-16 text-center bg-transparent font-bold text-gray-800 outline-none"
                    />
                    <button 
                      onClick={() => setQuantities(prev => ({ ...prev, [service.id]: (prev[service.id] || 1) + 1 }))}
                      className="p-2 hover:bg-gray-200 text-gray-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button 
                    onClick={() => handleAdd(service)}
                    disabled={price === 0}
                    className={cn(
                      "px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2",
                      price > 0 ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    )}
                  >
                    <Plus className="w-4 h-4" />
                    Добавить
                  </button>
                </div>
              </div>
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

const ServiceSectionView = ({ data, setData, mapLink }: { data: any, setData: (data: any) => void, mapLink: string }) => {
  const updateAddress = (field: string, value: string) => {
    setData({
      ...data,
      address: { ...data.address, [field]: value }
    });
  };

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
            <div className={cn(
              "w-12 h-6 rounded-full relative transition-colors",
              data.delivery ? "bg-blue-600" : "bg-gray-200"
            )}>
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                data.delivery ? "left-7" : "left-1"
              )} />
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
            <div className={cn(
              "w-12 h-6 rounded-full relative transition-colors",
              data.assembly ? "bg-blue-600" : "bg-gray-200"
            )}>
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                data.assembly ? "left-7" : "left-1"
              )} />
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
  setCatalogProducts,
  productCategories,
  setProductCategories,
  coefficients,
  productionFormat,
  onSaveProduct,
  onDeleteProduct
}: { 
  onAddProduct: (product: any, qty: number) => void;
  catalogProducts: any[];
  setCatalogProducts: React.Dispatch<React.SetStateAction<any[]>>;
  productCategories: string[];
  setProductCategories: React.Dispatch<React.SetStateAction<string[]>>;
  coefficients: any;
  productionFormat: string;
  onSaveProduct: (product: any) => void;
  onDeleteProduct: (id: number) => void;
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [newProduct, setNewProduct] = useState({ name: '', category: productCategories[0], purchasePrice: 0, image: '' });
  const [newCategory, setNewCategory] = useState('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProduct(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdd = (product: any) => {
    const qty = quantities[product.id] || 1;
    onAddProduct(product, qty);
    setQuantities(prev => ({ ...prev, [product.id]: 1 }));
  };

  const handleCreateProduct = () => {
    if (!newProduct.name || newProduct.purchasePrice <= 0) return;
    const coeff = coefficients.products?.[newProduct.category] || 1.5;
    const finalPrice = newProduct.purchasePrice * coeff;
    const product = {
      id: Date.now(),
      name: newProduct.name,
      category: newProduct.category,
      price: finalPrice,
      purchasePrice: newProduct.purchasePrice,
      description: 'Пользовательский товар',
      image: newProduct.image || `https://picsum.photos/seed/${Date.now()}/400/300`
    };
    onSaveProduct(product);
    setNewProduct({ name: '', category: productCategories[0], purchasePrice: 0, image: '' });
  };

  const handleDeleteProduct = (id: number) => {
    onDeleteProduct(id);
  };

  const handleAddCategory = () => {
    if (newCategory.trim() && !productCategories.includes(newCategory.trim())) {
      setProductCategories(prev => [...prev, newCategory.trim()]);
      setNewProduct(prev => ({ ...prev, category: newCategory.trim() }));
      setNewCategory('');
    }
  };

  const filteredProducts = catalogProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                         p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Товары</h2>
          <p className="text-sm text-gray-500">Выберите фурнитуру и аксессуары для проекта</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Поиск по названию или описанию..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-8">
        <h3 className="font-bold text-gray-800 mb-4">Добавить свой товар в каталог</h3>
        <div className="flex flex-col md:flex-row gap-4 flex-wrap">
          <input 
            type="text" 
            placeholder="Название товара"
            value={newProduct.name}
            onChange={e => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <select
            value={newProduct.category}
            onChange={e => setNewProduct(prev => ({ ...prev, category: e.target.value }))}
            className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {productCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              placeholder="Закупочная цена"
              value={newProduct.purchasePrice || ''}
              onChange={e => setNewProduct(prev => ({ ...prev, purchasePrice: parseFloat(e.target.value) || 0 }))}
              className="w-32 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <span className="font-bold text-gray-500">₽</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm text-gray-600 flex items-center gap-2">
              <Package className="w-4 h-4" />
              {newProduct.image ? 'Фото выбрано' : 'Загрузить фото'}
              <input 
                type="file" 
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>
          <button 
            onClick={handleCreateProduct}
            disabled={!newProduct.name || newProduct.purchasePrice <= 0}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
          >
            Добавить
          </button>
        </div>
        {newProduct.purchasePrice > 0 && productionFormat === 'own' && (
          <div className="mt-4 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
            Коэффициент категории "{newProduct.category}": <span className="font-bold">{coefficients.products?.[newProduct.category] || 1.5}</span>
            <br />
            Итоговая цена для клиента: <span className="font-bold text-blue-600">{(newProduct.purchasePrice * (coefficients.products?.[newProduct.category] || 1.5)).toLocaleString()} ₽</span>
          </div>
        )}
        
        <div className="mt-4 pt-4 border-t border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-1">Добавить новую категорию</label>
          <div className="flex gap-2">
            <input 
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full max-w-xs px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Название категории"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCategory();
              }}
            />
            <button
              onClick={handleAddCategory}
              disabled={!newCategory.trim()}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Добавить
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        <button 
          onClick={() => setSelectedCategory(null)}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
            !selectedCategory ? "bg-blue-600 text-white shadow-md" : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300"
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
              selectedCategory === cat ? "bg-blue-600 text-white shadow-md" : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {catalogProducts.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          Каталог товаров пуст. Добавьте свои товары выше.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-xl transition-all duration-300 flex flex-col">
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={product.image} 
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3">
                  <span className="px-2 py-1 bg-white/90 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider text-gray-600 rounded-md shadow-sm">
                    {product.category}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteProduct(product.id)}
                  className="absolute top-3 right-3 p-1.5 bg-white/90 backdrop-blur-sm text-red-500 hover:text-red-600 hover:bg-white rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                  title="Удалить товар"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-gray-800 mb-1 group-hover:text-blue-600 transition-colors">{product.name}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 mb-4 flex-1">{product.description}</p>
                <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-gray-900">{product.price.toLocaleString()} ₽</span>
                      {productionFormat === 'own' && product.purchasePrice && (
                        <span className="text-[10px] text-gray-400">Закупка: {product.purchasePrice.toLocaleString()} ₽</span>
                      )}
                    </div>
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50 scale-90 origin-right">
                      <button 
                        onClick={() => setQuantities(prev => ({ ...prev, [product.id]: Math.max(1, (prev[product.id] || 1) - 1) }))}
                        className="p-1.5 hover:bg-gray-200 text-gray-600 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input 
                        type="number" 
                        value={quantities[product.id] || 1}
                        onChange={(e) => setQuantities(prev => ({ ...prev, [product.id]: parseInt(e.target.value) || 1 }))}
                        className="w-10 text-center bg-transparent font-bold text-gray-800 outline-none text-sm"
                      />
                      <button 
                        onClick={() => setQuantities(prev => ({ ...prev, [product.id]: (prev[product.id] || 1) + 1 }))}
                        className="p-1.5 hover:bg-gray-200 text-gray-600 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleAdd(product)}
                    className="w-full py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm font-bold text-sm flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить
                  </button>
                </div>
              </div>
            </div>
          ))}
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
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'worker' | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [companyData, setCompanyData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Firebase Auth Listener
  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;
    let unsubscribeCompany: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Listen to user document
        unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), async (userDoc) => {
          if (userDoc.exists()) {
            const uData = userDoc.data();
            setUserData({ uid: user.uid, ...uData });
            setUserRole(uData.role);
            
            // Listen to company document
            if (unsubscribeCompany) unsubscribeCompany();
            unsubscribeCompany = onSnapshot(doc(db, 'companies', uData.companyId), (companyDoc) => {
              if (companyDoc.exists()) {
                const cData = companyDoc.data();
                setCompanyData({ id: companyDoc.id, ...cData });
                if (cData.productionFormat) {
                  setProductionFormat(cData.productionFormat);
                }
                setIsAuthenticated(true);
              }
              setIsLoading(false);
            }, (error) => {
              console.error("Company snapshot error:", error);
              setIsLoading(false);
            });
          } else {
            // User document doesn't exist yet (might be in middle of registration)
            // We wait for it to be created via onSnapshot
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
      alert("Ошибка входа: " + (error as Error).message);
    }
  };

  const handleRegister = async (data: RegistrationData) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.adminEmail, data.adminPassword);
      const user = userCredential.user;

      const companyId = Math.random().toString(36).substr(2, 9);
      
      // Create company
      await setDoc(doc(db, 'companies', companyId), {
        name: data.companyName,
        type: data.companyType,
        city: data.city,
        ownerUid: user.uid
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
      alert("Ошибка регистрации: " + (error as Error).message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const [activeTab, setActiveTab] = useState<'calculator' | 'price' | 'summary' | 'settings' | 'products' | 'services' | 'service-section' | 'production' | 'employees' | 'projects'>('calculator');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [results, setResults] = useState<any>(null);
  const [rotations, setRotations] = useState<Record<string, boolean>>({});
  const [edgeToEdge, setEdgeToEdge] = useState<Record<string, boolean>>({});
  const [sheetConfigs, setSheetConfigs] = useState<Record<string, SheetConfig>>({});
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [trimming, setTrimming] = useState(10);
  const [defaultCuttingType, setDefaultCuttingType] = useState<'saw' | 'nesting'>('saw');
  const [cuttingType, setCuttingType] = useState<'nesting' | 'saw'>(defaultCuttingType);
  const [kerf, setKerf] = useState(defaultCuttingType === 'nesting' ? 12 : 4);
  const [addedProducts, setAddedProducts] = useState<any[]>([]);
  const [addedServices, setAddedServices] = useState<any[]>([]);
  const [assemblyPercentage, setAssemblyPercentage] = useState(12);
  const [mapLink, setMapLink] = useState('https://yandex.ru/maps/');
  
  const [catalogProducts, setCatalogProducts] = useState<any[]>(SAMPLE_PRODUCTS);
  const [catalogServices, setCatalogServices] = useState<any[]>(SERVICES_LIST);
  const [productCategories, setProductCategories] = useState<string[]>(INITIAL_PRODUCT_CATEGORIES);
  
  const [productionFormat, setProductionFormat] = useState<ProductionFormat>('contract');
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

  // Data Synchronization
  useEffect(() => {
    if (!isAuthenticated || !companyData?.id) return;

    const companyId = companyData.id;

    // Sync Products
    const productsUnsubscribe = onSnapshot(
      collection(db, 'companies', companyId, 'products'),
      (snapshot) => {
        const products = snapshot.docs.map(doc => doc.data());
        setCatalogProducts(products.length > 0 ? products : (productionFormat === 'own' ? [] : SAMPLE_PRODUCTS));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `companies/${companyId}/products`)
    );

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
          setOwnProductionConfig(snapshot.data() as OwnProductionConfig);
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
          if (data.coefficients) setCoefficients(data.coefficients);
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
      settingsUnsubscribe();
      productionUnsubscribe();
      generalSettingsUnsubscribe();
    };
  }, [isAuthenticated, companyData?.id, productionFormat]);

  // Save actions
  const saveProject = async (projectName: string) => {
    if (!companyData?.id || !userData?.uid) return;
    try {
      const projectId = Date.now().toString();
      const projectData = {
        id: projectId,
        name: projectName,
        createdAt: new Date().toISOString(),
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
          serviceData
        }
      };
      await setDoc(doc(db, 'companies', companyData.id, 'projects', projectId), projectData);
      alert('Проект успешно сохранен');
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

  const deleteProduct = async (productId: number) => {
    if (!companyData?.id) return;
    try {
      await deleteDoc(doc(db, 'companies', companyData.id, 'products', productId.toString()));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `companies/${companyData.id}/products/${productId}`);
    }
  };

  const saveProductionConfig = async (config: OwnProductionConfig) => {
    if (!companyData?.id) return;
    try {
      await setDoc(doc(db, 'companies', companyData.id, 'settings', 'production'), config);
      // Also save productionFormat to company document
      await setDoc(doc(db, 'companies', companyData.id), { productionFormat }, { merge: true });
      alert('Настройки производства сохранены');
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
        productCategories
      });
      alert('Настройки успешно сохранены');
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
    extraLoaderPrice: 1000
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
  const [calcMode, setCalcMode] = useState<'sheet' | 'area'>('area');
  const [coefficients, setCoefficients] = useState({
    retail: {
      ldsp: 4,
      hdf: 4,
      edge: 4,
      facadeSheet: 1.8,
      products: INITIAL_PRODUCT_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: 1.5 }), {} as Record<string, number>)
    },
    wholesale: {
      ldsp: 2,
      hdf: 2,
      edge: 2,
      facadeSheet: 1.2,
      products: INITIAL_PRODUCT_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: 1.2 }), {} as Record<string, number>)
    }
  });
  const [hardwareKitPrice, setHardwareKitPrice] = useState(500);

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

          const area = (height * width * qty) / 1000000;
          const edgeLength = type === 'ХДФ' ? 0 : (edgeProc === '=' ? ((height + width) * 2 * qty) / 1000 : ((height + width) * qty) / 1000);

          return { type, name, height, edgeProc, width, thickness, qty, color, area, edgeLength };
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
            if (d.type === 'ХДФ') {
                initialSheetConfigs[key] = { width: 2800, height: 2070 };
                initialExpanded.add(key);
            }
          }
          grouped[key].area += d.area;
          grouped[key].edgeLength += d.edgeLength;
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

  const currentCoefficients = useMemo(() => {
    // If user is Salon or Designer and has selected a production company -> Wholesale
    if ((companyData?.companyType === 'Салон' || companyData?.companyType === 'Дизайнер') && contractConfig.productionId) {
      return coefficients.wholesale;
    }
    // Otherwise (including production employees) -> Retail
    return coefficients.retail;
  }, [companyData?.companyType, contractConfig.productionId, coefficients]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return authMode === 'login' ? (
      <LoginForm 
        onLogin={handleLogin}
        onGoToRegister={() => setAuthMode('register')}
      />
    ) : (
      <RegistrationForm 
        onRegister={handleRegister}
        onGoToLogin={() => setAuthMode('login')}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transition-all duration-300 shadow-xl lg:shadow-none",
        isSidebarOpen ? "w-64" : "w-20",
        !isSidebarOpen && "lg:w-20"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6 flex items-center justify-between">
            {isSidebarOpen && <span className="font-bold text-xl text-blue-600 truncate">Калькулятор</span>}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors ml-auto"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          <nav className="flex-1 px-4 space-y-2">
            <button 
              onClick={() => setActiveTab('calculator')}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                activeTab === 'calculator' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Calculator className="w-6 h-6 flex-shrink-0" />
              {isSidebarOpen && <span className="font-medium">Калькулятор</span>}
            </button>
            <button 
              onClick={() => setActiveTab('summary')}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                activeTab === 'summary' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <LayoutDashboard className="w-6 h-6 flex-shrink-0" />
              {isSidebarOpen && <span className="font-medium">Итоговый расчет</span>}
            </button>
            <button 
              onClick={() => setActiveTab('projects')}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                activeTab === 'projects' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <FolderOpen className="w-6 h-6 flex-shrink-0" />
              {isSidebarOpen && <span className="font-medium">Проекты</span>}
            </button>
            <button 
              onClick={() => setActiveTab('products')}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                activeTab === 'products' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <ShoppingBag className="w-6 h-6 flex-shrink-0" />
              {isSidebarOpen && <span className="font-medium">Товары</span>}
            </button>
            <button 
              onClick={() => setActiveTab('services')}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                activeTab === 'services' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Database className="w-6 h-6 flex-shrink-0" />
              {isSidebarOpen && <span className="font-medium">Услуги</span>}
            </button>
            <button 
              onClick={() => setActiveTab('service-section')}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                activeTab === 'service-section' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Truck className="w-6 h-6 flex-shrink-0" />
              {isSidebarOpen && <span className="font-medium">Сервис</span>}
            </button>
          </nav>

          <div className="p-4 border-t border-gray-100 space-y-2">
            <button 
              onClick={() => setActiveTab('price')}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                activeTab === 'price' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Tag className="w-6 h-6 flex-shrink-0" />
              {isSidebarOpen && <span className="font-medium">Прайс-лист</span>}
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                activeTab === 'settings' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Settings className="w-6 h-6 flex-shrink-0" />
              {isSidebarOpen && <span className="font-medium">Настройки</span>}
            </button>
            <button 
              onClick={() => setActiveTab('production')}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                activeTab === 'production' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Factory className="w-6 h-6 flex-shrink-0" />
              {isSidebarOpen && <span className="font-medium">Производство</span>}
            </button>
            {userRole === 'admin' && (
              <button 
                onClick={() => setActiveTab('employees')}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                  activeTab === 'employees' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <Users className="w-6 h-6 flex-shrink-0" />
                {isSidebarOpen && <span className="font-medium">Сотрудники</span>}
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-4 p-3 rounded-xl text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-6 h-6 flex-shrink-0" />
              {isSidebarOpen && <span className="font-medium">Выйти</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300",
        isSidebarOpen ? "lg:ml-64" : "lg:ml-20"
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
            hardwareKitPrice={hardwareKitPrice}
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
          />
        ) : activeTab === 'projects' ? (
          <ProjectsView 
            companyId={companyData?.id}
            userId={userData?.uid}
            userRole={userRole}
            onLoadProject={loadProject}
          />
        ) : activeTab === 'products' ? (
          <ProductsView 
            onAddProduct={onAddProduct} 
            catalogProducts={catalogProducts}
            setCatalogProducts={setCatalogProducts}
            productCategories={productCategories}
            setProductCategories={setProductCategories}
            coefficients={currentCoefficients}
            productionFormat={productionFormat}
            onSaveProduct={saveProduct}
            onDeleteProduct={deleteProduct}
          />
        ) : activeTab === 'services' ? (
          <ServicesView 
            onAddService={onAddService} 
            prices={prices} 
            catalogServices={catalogServices}
            setCatalogServices={setCatalogServices}
          />
        ) : activeTab === 'service-section' ? (
          <ServiceSectionView data={serviceData} setData={setServiceData} mapLink={mapLink} />
        ) : activeTab === 'price' ? (
          <PriceView 
            calcMode={calcMode}
            prices={prices}
            setPrices={setPrices}
            canEditCabinet={canEditCabinet}
            canEditFacades={canEditFacades}
            catalogServices={catalogServices}
          />
        ) : activeTab === 'production' ? (
          <ProductionView 
            productionFormat={productionFormat}
            setProductionFormat={setProductionFormat}
            contractConfig={contractConfig}
            setContractConfig={setContractConfig}
            ownProductionConfig={ownProductionConfig}
            setOwnProductionConfig={setOwnProductionConfig}
            companyType={companyData?.companyType}
            onSaveConfig={saveProductionConfig}
          />
        ) : activeTab === 'employees' ? (
          <AdminSettingsView companyId={companyData?.id} />
        ) : (
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
            onSaveSettings={saveGeneralSettings}
          />
        )}
      </main>
    </div>
  );
}
