const fs = require('fs');

let file = fs.readFileSync('src/components/Projects/SpecificationPrintView.tsx', 'utf8');

file = file.replace(/<div className="border border-black">/g, '<div className="border border-gray-200 rounded-xl overflow-hidden mb-8 shadow-sm">');
file = file.replace(/<div className="bg-yellow-300 font-bold p-2 text-center border-b border-black">/g, '<div className="bg-yellow-50 font-bold p-4 text-center border-b border-yellow-200 text-yellow-900 flex items-center justify-center gap-3">');
file = file.replace(/Общая сумма: \{summary\.totalOverall\.toLocaleString\(\)\} ₽ — Стоимость изделия, товаров и услуг/g, '<span className="text-xl">Общая сумма: {(summary.totalOverall || 0).toLocaleString()} ₽</span>\n                <span className="text-sm font-medium opacity-75">— Стоимость изделия, товаров и услуг</span>');

file = file.replace(/<div className="p-2 border-b border-black text-sm">/g, '<div className="p-4 border-b border-gray-100 bg-gray-50 text-sm h-auto font-bold text-gray-700">');
file = file.replace(/<div className="grid grid-cols-\[1fr,2fr\] text-xs border-b border-black">/g, '<div className="grid grid-cols-[1fr,2fr] text-sm border-b border-gray-50 bg-white">');
file = file.replace(/<div className="p-2 border-r border-black font-medium">/g, '<div className="p-3 border-r border-gray-50 font-medium text-gray-500">');
file = file.replace(/<div className="p-2">/g, '<div className="p-3 text-gray-800">');

fs.writeFileSync('src/components/Projects/SpecificationPrintView.tsx', file);
