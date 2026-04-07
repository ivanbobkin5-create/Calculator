import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
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
  Database
} from 'lucide-react';
import { LDSP_DATABASE, NORDECO_EDGE_MAPPING } from './constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

export default function App() {
  const [activeTab, setActiveTab] = useState<'calculator' | 'price' | 'summary' | 'settings'>('calculator');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [results, setResults] = useState<any>(null);
  const [rotations, setRotations] = useState<Record<string, boolean>>({});
  const [edgeToEdge, setEdgeToEdge] = useState<Record<string, boolean>>({});
  const [sheetConfigs, setSheetConfigs] = useState<Record<string, SheetConfig>>({});
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [cuttingType, setCuttingType] = useState<'nesting' | 'saw'>('saw');
  const [kerf, setKerf] = useState(4);

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

  const [searchQuery, setSearchQuery] = useState('');
  const [facadeSearchQuery, setFacadeSearchQuery] = useState('');
  const [selectedDecor, setSelectedDecor] = useState<Record<string, string>>({});
  const [edgeThickness, setEdgeThickness] = useState<Record<string, string>>({});
  const [edgeDecor, setEdgeDecor] = useState<Record<string, string>>({});
  const [facadeType, setFacadeType] = useState<Record<string, 'sheet' | 'custom'>>({});
  const [edgePrices, setEdgePrices] = useState<Record<string, number>>({});
  const [calcMode, setCalcMode] = useState<'sheet' | 'area'>('area');
  const [coefficients, setCoefficients] = useState({
    ldsp: 4,
    hdf: 4,
    edge: 4,
    facadeSheet: 1.8
  });

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

  const PriceView = () => {
    const [priceSearch, setPriceSearch] = useState('');
    const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set(Object.keys(LDSP_DATABASE)));

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
            <div className="flex gap-2">
              <button 
                onClick={() => setExpandedBrands(new Set(Object.keys(LDSP_DATABASE)))}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100"
                title="Развернуть все"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setExpandedBrands(new Set())}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                title="Свернуть все"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {Object.entries(LDSP_DATABASE).map(([brand, decors]) => {
            const filtered = decors.filter(d => d.toLowerCase().includes(priceSearch.toLowerCase()));
            if (priceSearch && filtered.length === 0) return null;

            return (
              <div key={brand} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <button 
                  onClick={() => toggleBrand(brand)}
                  className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-gray-800">{brand}</span>
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{decors.length}</span>
                  </div>
                  {expandedBrands.has(brand) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
                
                {expandedBrands.has(brand) && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(decor => (
                      <div key={decor} className="p-3 border border-gray-100 rounded-lg hover:border-blue-200 transition-colors group">
                        <div className="text-sm font-medium text-gray-700 mb-2 truncate" title={decor}>{decor}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">Цена:</span>
                          <input 
                            type="number" 
                            value={prices[`${brand}|${decor}`] || ''}
                            onChange={(e) => setPrices(prev => ({ ...prev, [`${brand}|${decor}`]: parseFloat(e.target.value) }))}
                            placeholder="0.00"
                            className="w-full text-sm border-b border-gray-200 focus:border-blue-500 outline-none py-1 group-hover:bg-blue-50/30 px-1"
                          />
                          <span className="text-xs text-gray-400">₽/{calcMode === 'area' ? 'м²' : 'лист'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      delimiter: ';',
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as string[][];
        processData(data);
      }
    });
  };

  const processData = (data: string[][]) => {
    const parsedDetails: Detail[] = data.map(row => {
      const name = row[0];
      const height = parseFloat(row[1]);
      const edgeProc = row[2].trim();
      const width = parseFloat(row[3]);
      const thickness = parseFloat(row[5]);
      const qty = parseFloat(row[6]);
      const color = row[7];

      let type = '';
      if (name.includes('Фасад')) type = 'Фасад';
      else if (name.includes('ЛДСП') || name.includes('ДСП')) type = 'ЛДСП';
      else if (name.includes('МДФ')) type = 'МДФ';
      else if (name.includes('ДВП')) type = 'ХДФ';
      else if (name.includes('ХДФ')) type = 'ХДФ';

      let h = height;
      let w = width;

      const area = (h * w * qty) / 1000000;
      const edgeLength = type === 'ХДФ' ? 0 : (edgeProc === '=' ? ((h + w) * 2 * qty) / 1000 : ((h + w) * qty) / 1000);

      return { type, name, height: h, edgeProc, width: w, thickness, qty, color, area, edgeLength };
    }).filter(d => d.type !== '');

    const grouped: any = {};
    const initialSheetConfigs: Record<string, SheetConfig> = {};
    
    const initialExpanded: Set<string> = new Set();
    parsedDetails.forEach(d => {
      // Group facades by type, color and thickness only to merge "Facade top", "Facade bottom" etc.
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
      // Expand qty into individual items for packing
      for(let i=0; i<d.qty; i++) {
        grouped[key].details.push({ ...d, rotated: false });
      }
    });

    setSheetConfigs(prev => ({ ...prev, ...initialSheetConfigs }));
    setExpandedResults(prev => new Set([...prev, ...initialExpanded]));
    setResults(grouped);
  };

  const updateSheetConfig = (key: string, brand: SheetConfig) => {
    setSheetConfigs(prev => ({ ...prev, [key]: brand }));
  };

  const FACADE_BRANDS: Record<string, SheetConfig> = {
    'AGT': { width: 2800, height: 1220 },
    'Evogloss': { width: 2800, height: 1220 },
    'Evosoft': { width: 2800, height: 1220 },
    'Arkopa': { width: 2800, height: 1220 },
  };

  const LDSP_BRANDS = [
    { name: 'Kronospan (2800x2070)', width: 2800, height: 2070 },
    { name: 'Egger (2800x2070)', width: 2800, height: 2070 },
    { name: 'Lamarty (2750x1830)', width: 2750, height: 1830 },
    { name: 'Nordeco (2800x2070)', width: 2800, height: 2070 },
    { name: 'Uvadrev (2440x1830)', width: 2440, height: 1830 },
  ];

  const SummaryView = () => {
    if (!results) return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <Calculator className="w-12 h-12 mb-4" />
        <p>Загрузите файл раскроя для получения итогового расчета</p>
      </div>
    );

    let totalCost = 0;
    let allDataEntered = true;

    const summaryRows = Object.entries(results).flatMap(([key, item]: any) => {
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
      
      if (isCustomFacade) {
        itemCost = item.area * price;
        qtyText = `${item.area.toFixed(2)} м²`;
      } else {
        const sheets = packDetails(item.details, sheetConfigs[key]?.width || 2800, sheetConfigs[key]?.height || 2070, kerf, rotations[key] || false, cuttingType);
        const sheetCount = sheets.length;
        const sheetArea = (sheetConfigs[key]?.width || 2800) * (sheetConfigs[key]?.height || 2070) / 1000000;
        
        if (calcMode === 'area') {
          itemCost = sheetCount * sheetArea * price * coef;
        } else {
          itemCost = sheetCount * price * coef;
        }
        qtyText = `${sheetCount} л.`;
      }
      
      if (price === 0) allDataEntered = false;

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

      // Edge Row
      if (item.type !== 'ХДФ' && (item.type !== 'Фасад' || isSheetFacade)) {
        const isFacade = item.type === 'Фасад';
        const edgeLen = (edgeToEdge[key] || isFacade)
          ? (item.details.reduce((sum: any, d: any) => sum + ((d.width + d.height) * 2), 0) / 1000)
          : item.edgeLength;
        const ePrice = edgePrices[key] || 0;
        const eCost = edgeLen * ePrice * coefficients.edge;
        
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
          coef: coefficients.edge
        });
      }

      return rows;
    });

    totalCost = summaryRows.reduce((sum, row) => sum + row.total, 0);
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
              {summaryRows.map((row, idx) => (
                <tr key={idx} className={cn("hover:bg-gray-50 transition-colors", row.isEdge && "bg-gray-50/30")}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{row.name}</div>
                    <div className="text-xs text-gray-500">{row.sub}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("text-sm font-medium", row.decor === 'Не выбран' || row.decor === 'Не указан' ? "text-gray-400 italic" : "text-blue-600")}>
                      {row.decor}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-sm">{row.qty}</td>
                  <td className="px-6 py-4 text-right font-mono text-sm">
                    {row.isEdge ? (
                      <div className="flex items-center justify-end gap-2">
                        <input 
                          type="number"
                          value={edgePrices[row.key!] || ''}
                          onChange={(e) => setEdgePrices(prev => ({ ...prev, [row.key!]: parseFloat(e.target.value) || 0 }))}
                          placeholder="0"
                          className="w-20 p-1 border border-gray-200 rounded text-right text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <span>₽</span>
                      </div>
                    ) : (
                      `${row.price.toLocaleString()} ₽`
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-gray-900">{row.total.toLocaleString()} ₽</td>
                </tr>
              ))}
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
      </div>
    );
  };

  const SettingsView = () => {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-12">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-8">
          <section>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Общие настройки</h3>
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
                  className="w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
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
                  className="w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
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
                  className="w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
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
                  className="w-24 p-2 border border-gray-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </section>
          
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
            {isSidebarOpen && <span className="font-bold text-xl text-blue-600 truncate">Pro100 Calc</span>}
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
              onClick={() => setActiveTab('price')}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
                activeTab === 'price' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Tag className="w-6 h-6 flex-shrink-0" />
              {isSidebarOpen && <span className="font-medium">Прайс-лист</span>}
            </button>
          </nav>

          <div className="p-4 border-t border-gray-100 space-y-2">
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
            <div className={cn(
              "flex items-center gap-4 p-3 text-gray-400",
              !isSidebarOpen && "justify-center"
            )}>
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                {results ? Object.keys(results).length : 0}
              </div>
              {isSidebarOpen && <span className="text-sm">Материалов</span>}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300",
        isSidebarOpen ? "lg:ml-64" : "lg:ml-20"
      )}>
        {activeTab === 'calculator' ? (
          <div className="p-4 md:p-8">
            <div className="max-w-5xl mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-8">
                <LayoutDashboard className="w-8 h-8 text-blue-600" />
                <h1 className="text-3xl font-bold text-gray-900">Мебельный калькулятор</h1>
              </div>
              
              <div className="mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Загрузить файл раскроя (CSV)</label>
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
                      onChange={(e) => setKerf(parseFloat(e.target.value))} 
                      className="w-full border-gray-200 rounded-lg p-2 border bg-white focus:ring-2 focus:ring-blue-500 outline-none" 
                    />
                  </div>
                </div>
              </div>
              
              {results && (
                <div className="space-y-8">
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Settings className="w-5 h-5 text-gray-400" />
                      <h2 className="text-xl font-semibold text-gray-800">Настройка материалов</h2>
                    </div>
                    <div className="grid gap-4">
                      {Object.keys(results).filter(key => results[key].type === 'ЛДСП' || results[key].type === 'МДФ').map(key => {
                        const item = results[key];
                        return (
                          <div key={key} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                                  <Database className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  <span className="font-bold text-gray-800 block">{item.color}</span>
                                  <span className="text-xs text-gray-500">Толщина: {item.thickness} мм</span>
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
                                      {filteredDecors.map(d => (
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

                            {/* Edge Banding Settings */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                              <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Толщина кромки</label>
                                <select 
                                  value={edgeThickness[key] || '0.4'}
                                  onChange={(e) => setEdgeThickness(prev => ({ ...prev, [key]: e.target.value }))}
                                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                >
                                  <option value="0.4">0.4 мм</option>
                                  <option value="0.8">0.8 мм</option>
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
                                {selectedDecor[key]?.startsWith('Nordeco') && (
                                  <div className="mt-1">
                                    {(() => {
                                      const decorName = selectedDecor[key].replace('Nordeco ', '');
                                      const mapping = NORDECO_EDGE_MAPPING[decorName];
                                      if (mapping) {
                                        return (
                                          <div className="flex flex-wrap gap-1">
                                            {mapping.rehau && (
                                              <button 
                                                onClick={() => setEdgeDecor(prev => ({ ...prev, [key]: mapping.rehau! }))}
                                                className="text-[10px] bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded text-gray-600"
                                              >
                                                REHAU: {mapping.rehau}
                                              </button>
                                            )}
                                            {mapping.galoplast && (
                                              <button 
                                                onClick={() => setEdgeDecor(prev => ({ ...prev, [key]: mapping.galoplast! }))}
                                                className="text-[10px] bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded text-gray-600"
                                              >
                                                Galoplast: {mapping.galoplast}
                                              </button>
                                            )}
                                            {mapping.kantenwelt && (
                                              <button 
                                                onClick={() => setEdgeDecor(prev => ({ ...prev, [key]: mapping.kantenwelt! }))}
                                                className="text-[10px] bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded text-gray-600"
                                              >
                                                KW: {mapping.kantenwelt}
                                              </button>
                                            )}
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Facades Section */}
                      {Object.keys(results).filter(key => results[key].type === 'Фасад').map(key => {
                        const item = results[key];
                        return (
                          <div key={key} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                                  <Calculator className="w-5 h-5 text-purple-600" />
                                </div>
                                <div>
                                  <span className="font-bold text-gray-800 block">{item.color}</span>
                                  <span className="text-xs text-gray-500">Фасады ({item.thickness} мм)</span>
                                </div>
                              </div>
                              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                                <button 
                                  onClick={() => setFacadeType(prev => ({ ...prev, [key]: 'sheet' }))}
                                  className={cn(
                                    "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                                    (facadeType[key] || 'sheet') === 'sheet' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                  )}
                                >
                                  Плитные
                                </button>
                                <button 
                                  onClick={() => setFacadeType(prev => ({ ...prev, [key]: 'custom' }))}
                                  className={cn(
                                    "px-4 py-1.5 rounded-md text-xs font-bold transition-all",
                                    facadeType[key] === 'custom' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                  )}
                                >
                                  Заказные
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
                                item.type === 'Фасад' ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
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
                                {packDetails(item.details, sheetConfigs[key].width, sheetConfigs[key].height, kerf, rotations[key] || false, cuttingType).map((sheet: Detail[], sheetIndex: number) => {
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
                                      <div className="border-4 border-gray-100 relative bg-gray-50 mx-auto rounded-lg overflow-hidden" style={{ width: '100%', maxWidth: '800px', aspectRatio: `${sheetConfigs[key].width} / ${sheetConfigs[key].height}` }}>
                                        {sheet.map((d: Detail, i: number) => (
                                          <div key={i} className="bg-blue-100 border border-blue-300 text-[10px] p-1 absolute flex flex-col items-center justify-center overflow-hidden hover:bg-blue-200 transition-all cursor-help group" style={{ 
                                            left: `${(d.packedX! / sheetConfigs[key].width) * 100}%`, 
                                            top: `${(d.packedY! / sheetConfigs[key].height) * 100}%`,
                                            width: `${(d.width / sheetConfigs[key].width) * 100}%`, 
                                            height: `${(d.height / sheetConfigs[key].height) * 100}%` 
                                          }}>
                                            <span className="font-bold truncate w-full text-center text-blue-800">{d.name}</span>
                                            <span className="truncate w-full text-center text-blue-600/70">{d.label}</span>
                                            <div className="absolute inset-0 bg-blue-600 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-[8px] font-bold transition-opacity">
                                              {d.width} x {d.height}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
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
          </div>
        ) : activeTab === 'summary' ? (
          <SummaryView />
        ) : activeTab === 'price' ? (
          <PriceView />
        ) : (
          <SettingsView />
        )}
      </main>
    </div>
  );
}
