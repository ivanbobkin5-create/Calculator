import React from 'react';

export const SpecificationPrintView = ({
  projects,
  setData,
  onClose
}: {
  projects: any[];
  setData: any;
  onClose: () => void;
}) => {
  const summary = setData.summary;
  
  return (
    <div className="fixed inset-0 z-[200] bg-gray-500 overflow-y-auto print:bg-white print:z-[9999]">
      <div className="max-w-[210mm] mx-auto bg-white min-h-[297mm] shadow-2xl print:shadow-none print:w-full print:border-none p-8 md:p-12 mb-20 print:mb-0 relative">
        
        <div className="absolute top-4 right-4 print:hidden flex items-center gap-2">
          <button 
            onClick={() => window.print()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
          >
            Печать
          </button>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300"
          >
            Закрыть
          </button>
        </div>

        {/* Page 1: Sketches */}
        {setData.sketches && setData.sketches.length > 0 && (
          <div className="page-break-after-always mb-16">
            <h1 className="text-xl font-bold mb-2 uppercase">Эскиз продукции утвержденный Заказчиком (Приложение №1)</h1>
            <p className="text-sm text-gray-700 mb-8">ПО ДОГОВОРУ № {setData.contractNumber} от {new Date(setData.contractDate).toLocaleDateString('ru-RU')}</p>
            
            <div className="space-y-8">
              {setData.sketches.map((url: string, idx: number) => (
                <div key={idx} className="w-full">
                  <h2 className="text-sm font-bold mb-4">ЭСКИЗ {idx + 1}</h2>
                  <img src={url} alt={`Sketch ${idx + 1}`} className="max-w-full h-auto object-contain max-h-[800px]" referrerPolicy="no-referrer" />
                </div>
              ))}
            </div>

            <div className="mt-8 text-xs text-gray-500">
              <p>Заказчик уведомлен, что отображение цветов на мониторах и мобильных устройствах может отличаться от выбранного декора. Цвет декора соответствует исключительно представленному образцу.</p>
              <br/>
              <p>Заказчик подтверждает и согласен с эскизами и размерами указанными на нем, а также с информацией, указывающей на технические особенности элементов продукции.</p>
            </div>
          </div>
        )}

        {/* Page 2: Specification */}
        <div>
          <h1 className="text-xl font-bold mb-2 uppercase">Спецификация заказа утвержденная Заказчиком (Приложение №2)</h1>
          <p className="text-sm text-gray-700 mb-8">ПО ДОГОВОРУ № {setData.contractNumber} от {new Date(setData.contractDate).toLocaleDateString('ru-RU')}</p>

           <div className="mb-8 grid grid-cols-2 gap-8 text-sm">
             <div>
               <p><span className="text-gray-500">Сумма:</span> <span className="font-bold">{summary.totalOverall.toLocaleString()} ₽</span></p>
             </div>
             <div>
               <p className="font-bold mb-1">Расшифровка:</p>
               <p><span className="text-gray-500 w-32 inline-block">Материалы:</span> {(summary.totalMaterialsPrice || 0).toLocaleString()} ₽</p>
               <p><span className="text-gray-500 w-32 inline-block">Фурнитура/Товары:</span> {(summary.totalHardwarePrice || 0).toLocaleString()} ₽</p>
               <p><span className="text-gray-500 w-32 inline-block">Услуги/Доставка:</span> {(summary.totalServicesPrice + summary.totalDeliveryPrice).toLocaleString()} ₽</p>
               <p><span className="text-gray-500 w-32 inline-block">Сборка:</span> {(summary.totalAssemblyPrice || 0).toLocaleString()} ₽</p>
             </div>
           </div>

           <div className="border border-black">
             {/* General Info */}
             <div className="bg-yellow-300 font-bold p-2 text-center border-b border-black">
               Общая сумма: {summary.totalOverall.toLocaleString()} ₽ — Стоимость изделия, товаров и услуг
             </div>

             <div className="p-2 border-b border-black text-sm">
               <span className="font-bold">Используемый материал в Продукции:</span>
             </div>
             
             {/* Dynamic breakdown from projects */}
             {projects.map((p, idx) => {
               return (
                 <div key={p.id}>
                   <div className="grid grid-cols-[1fr,2fr] text-xs border-b border-black">
                     <div className="p-2 border-r border-black font-medium">Проект {idx + 1}</div>
                     <div className="p-2">{p.name}</div>
                   </div>
                   <div className="grid grid-cols-[1fr,2fr] text-xs border-b border-black">
                     <div className="p-2 border-r border-black font-medium">Материал/Декор</div>
                     <div className="p-2">{p.data?.decor || '-'}</div>
                   </div>
                   <div className="grid grid-cols-[1fr,2fr] text-xs border-b border-black">
                     <div className="p-2 border-r border-black font-medium">Кромка</div>
                     <div className="p-2">{p.data?.edge || '-'}</div>
                   </div>
                   <div className="grid grid-cols-[1fr,2fr] text-xs border-b border-black">
                     <div className="p-2 border-r border-black font-medium">Фасады</div>
                     <div className="p-2">{p.data?.facades || '-'}</div>
                   </div>
                 </div>
               )
             })}

             {/* Items Table */}
             <div className="bg-indigo-600 text-white font-bold p-2 text-sm">Товары и комплектующие</div>
             <table className="w-full text-xs">
               <thead>
                 <tr className="bg-gray-100 border-b border-black">
                   <th className="text-left p-2 border-r border-black w-2/3">Наименование</th>
                   <th className="p-2 border-r border-black w-16">Кол-во</th>
                   <th className="p-2 border-r border-black w-24">Цена</th>
                   <th className="p-2 w-24">Сумма</th>
                 </tr>
               </thead>
               <tbody>
                 {summary.hardware.map((item: any, idx: number) => (
                   <tr key={idx} className="border-b border-black">
                     <td className="p-2 border-r border-black">{item.name}</td>
                     <td className="p-2 border-r border-black text-center">{item.qty} {item.unit || 'шт'}</td>
                     <td className="p-2 border-r border-black text-right">{(item.price || 0).toLocaleString()} ₽</td>
                     <td className="p-2 text-right">{((item.price || 0) * item.qty).toLocaleString()} ₽</td>
                   </tr>
                 ))}
               </tbody>
             </table>

             {/* Services Table */}
             <div className="bg-orange-100 font-bold justify-between p-2 flex text-sm flex-row">
               <span>Услуги, доставка и сборка</span>
             </div>
             <table className="w-full text-xs">
               <tbody>
                 {summary.services.map((item: any, idx: number) => (
                   <tr key={idx} className="border-b border-black">
                     <td className="p-2 border-r border-black w-2/3">{item.name}</td>
                     <td className="p-2 border-r border-black text-center w-16">{item.qty} {item.unit}</td>
                     <td className="p-2 border-r border-black text-right w-24">{(item.price || 0).toLocaleString()} ₽</td>
                     <td className="p-2 text-right w-24">{((item.price || 0) * item.qty).toLocaleString()} ₽</td>
                   </tr>
                 ))}
                 <tr className="border-b border-black">
                   <td className="p-2 border-r border-black" colSpan={3}>Доставка</td>
                   <td className="p-2 text-right">{summary.totalDeliveryPrice.toLocaleString()} ₽</td>
                 </tr>
                 <tr className="border-b border-black">
                   <td className="p-2 border-r border-black" colSpan={3}>Сборка</td>
                   <td className="p-2 text-right">{summary.totalAssemblyPrice.toLocaleString()} ₽</td>
                 </tr>
               </tbody>
             </table>
           </div>

           <div className="mt-8 text-xs text-gray-500">
             <p>Заказчик подтверждает и согласен со Спецификацией к заказу.</p>
           </div>
        </div>

      </div>
       {/* Global print styles hidden in regular view */}
       <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:bg-white, .print\\:bg-white * {
            visibility: visible;
          }
          .print\\:bg-white {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}} />
    </div>
  );
};
