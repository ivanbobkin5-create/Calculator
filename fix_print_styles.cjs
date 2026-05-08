const fs = require('fs');

let file = fs.readFileSync('src/components/Projects/SpecificationPrintView.tsx', 'utf8');

// Add break-inside-avoid to the specific blocks
file = file.replace(
  /<div className="mt-8 text-xs text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-100">/g,
  '<div className="mt-8 text-xs text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-100 break-inside-avoid shadow-sm">'
);

// Add break-inside-avoid to Materials/Products/Services blocks
file = file.replace(
  /<div className="border border-gray-200 rounded-xl overflow-hidden mb-8 shadow-sm">/g,
  '<div className="border border-gray-200 rounded-xl overflow-hidden mb-8 shadow-sm break-inside-avoid">'
);

file = file.replace(
  /<div className="mb-6">/g,
  '<div className="mb-6 break-inside-avoid">'
);

// Services Table wrapper
file = file.replace(
  /<div className="bg-orange-50 font-bold p-3 text-sm text-orange-900 rounded-t-xl border border-b-0 border-orange-100 flex items-center gap-2">/g,
  '<div className="bg-orange-50 font-bold p-3 text-sm text-orange-900 rounded-t-xl border border-b-0 border-orange-100 flex items-center gap-2 break-inside-avoid">'
);

// We need to add break-inside-avoid wrapper for services wrapper
file = file.replace(
  /\{\(summary\.services\.length > 0 \|\| summary\.totalDeliveryPrice > 0 \|\| summary\.totalAssemblyPrice > 0\) && \(\n              <div>/g,
  '{(summary.services.length > 0 || summary.totalDeliveryPrice > 0 || summary.totalAssemblyPrice > 0) && (\n              <div className="break-inside-avoid">'
);

file = file.replace(
  /<div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-2 gap-8 text-sm">/g,
  '<div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-2 gap-8 text-sm break-inside-avoid">'
);

// Add print-color-adjust for webkit also with different syntax just in case
file = file.replace(
  /-webkit-print-color-adjust: exact !important;/g,
  '-webkit-print-color-adjust: exact !important;\n            color-adjust: exact !important;'
);

fs.writeFileSync('src/components/Projects/SpecificationPrintView.tsx', file);
