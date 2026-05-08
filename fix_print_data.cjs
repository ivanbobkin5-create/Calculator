const fs = require('fs');

let file = fs.readFileSync('src/components/Projects/SpecificationPrintView.tsx', 'utf8');

file = file.replace(
/                     <div className="p-3 text-gray-800">\{p\.data\?\.decor \|\| '-'}<\/div>\n                   <\/div>\n                   <div className="grid grid-cols-\[1fr,2fr\] text-sm border-b border-gray-50 bg-white">\n                     <div className="p-3 border-r border-gray-50 font-medium text-gray-500">Кромка<\/div>\n                     <div className="p-3 text-gray-800">\{p\.data\?\.edge \|\| '-'}<\/div>\n                   <\/div>\n                   <div className="grid grid-cols-\[1fr,2fr\] text-sm border-b border-gray-50 bg-white">\n                     <div className="p-3 border-r border-gray-50 font-medium text-gray-500">Фасады<\/div>\n                     <div className="p-3 text-gray-800">\{p\.data\?\.facades \|\| '-'}<\/div>/g,
`                     <div className="p-3 text-gray-800">
                       {p.data?.summaryRows ? Array.from(new Set(p.data.summaryRows.filter((r: any) => r.type === 'material').map((r: any) => \`\${r.category || ''} \${r.decor || ''}\`.trim()).filter(Boolean))).join(', ') : (p.data?.results ? Array.from(new Set(Object.values(p.data.results).map((r: any) => \`\${r.category || ''} \${r.decor || ''}\`.trim()).filter(Boolean))).join(', ') : '-')}
                     </div>
                   </div>
                   <div className="grid grid-cols-[1fr,2fr] text-sm border-b border-gray-50 bg-white">
                     <div className="p-3 border-r border-gray-50 font-medium text-gray-500">Кромка</div>
                     <div className="p-3 text-gray-800">
                       {p.data?.edgeDecor ? Array.from(new Set(Object.values(p.data.edgeDecor).flatMap((e: any) => Object.values(e)))).join(', ') : '-'}
                     </div>
                   </div>
                   <div className="grid grid-cols-[1fr,2fr] text-sm border-b border-gray-50 bg-white">
                     <div className="p-3 border-r border-gray-50 font-medium text-gray-500">Фасады</div>
                     <div className="p-3 text-gray-800">
                       {p.data?.facadeCustomType ? \`Свой: \${p.data.facadeCustomType}\` : (p.data?.facadeType ? \`\${p.data.facadeType} \${p.data?.facadeCategory || ''} \${p.data?.facadeMilling || ''}\` : '-')}
                     </div>`
);

// fix hanging PDF
file = file.replace(
/  const handleSavePdf = async \(\) => \{\n    if \(\!contentRef\.current\) return;\n    setIsGeneratingPdf\(true\);\n    try \{\n      const opt = \{\n        margin:       \[10, 10, 10, 10\],\n        filename:     \`Спецификация_\$\{setData\.contractNumber \|\| 'Заказ'\}\.pdf\`,\n        image:        \{ type: 'jpeg', quality: 0\.98 \},\n        html2canvas:  \{ scale: 2, useCORS: true \},\n        jsPDF:        \{ unit: 'mm', format: 'a4', orientation: 'portrait' \}\n      \};\n      await html2pdf\(\)\.from\(contentRef\.current\)\.set\(opt\)\.save\(\);\n    \} finally \{\n      setIsGeneratingPdf\(false\);\n    \}\n  \};/g,
`  const handleSavePdf = () => {
    if (!contentRef.current) return;
    setIsGeneratingPdf(true);
    
    // Give UI a chance to render spinner
    setTimeout(async () => {
      try {
        const opt = {
          margin:       [10, 10, 10, 10], // top, left, right, bottom
          filename:     \`Спецификация_\${setData.contractNumber || 'Заказ'}.pdf\`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, allowTaint: true, logging: false },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        const pdf = html2pdf().from(contentRef.current).set(opt);
        await Promise.race([
          pdf.save(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15000))
        ]);
      } catch (err) {
        console.error('PDF generation error:', err);
        alert('Не удалось сгенерировать PDF (возможно тяжелые изображения или проблемы с сетью). Пожалуйста, используйте кнопку "Печать" -> "Сохранить как PDF" в браузере.');
      } finally {
        setIsGeneratingPdf(false);
      }
    }, 100);
  };`
);

fs.writeFileSync('src/components/Projects/SpecificationPrintView.tsx', file);
