import React, { useRef, useState } from "react";
import html2pdf from "html2pdf.js";
import { Download, Loader2 } from "lucide-react";

export const SpecificationPrintView = ({
  projects,
  setData,
  onClose,
}: {
  projects: any[];
  setData: any;
  onClose: () => void;
}) => {
  const summary = setData.summary;
  const contentRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleSavePdf = async () => {
    if (!contentRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const opt = {
        margin: [5, 5, 5, 5] as [number, number, number, number], // top, right, bottom, left
        filename: `Спецификация_${setData.contractNumber || "Заказ"}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: {
          unit: "mm" as const,
          format: "a4" as const,
          orientation: "portrait" as const,
        },
      };
      await html2pdf().from(contentRef.current).set(opt).save();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-gray-500 overflow-y-auto print:bg-transparent print:static print:overflow-visible">
      <div className="absolute top-4 right-4 print:hidden flex items-center gap-2 z-10 sticky md:fixed md:top-8 md:right-8 bg-white/80 backdrop-blur pb-4 pt-4 px-4 rounded-xl shadow-sm">
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

      <div
        ref={contentRef}
        className="max-w-[210mm] mx-auto bg-white min-h-[297mm] shadow-2xl print:shadow-none print:w-full print:border-none p-4 sm:p-6 md:p-8 mb-20 mt-20 md:mt-10 print:m-0 print:p-0 relative"
      >
        {/* Page 1: Sketches */}
        {setData.sketches && setData.sketches.length > 0 && (
          <div className="page-break-after-always mb-16">
            <h1 className="text-xl font-bold mb-4 uppercase">
              Эскизы к договору № {setData.contractNumber} от{" "}
              {new Date(setData.contractDate).toLocaleDateString("ru-RU")}
            </h1>

            <div className="space-y-8 mt-4">
              {setData.sketches.map((url: string, idx: number) => (
                <div key={idx} className="w-full">
                  <h2 className="text-sm font-bold mb-4">Эскиз {idx + 1}</h2>
                  <img
                    src={url}
                    alt={`Эскиз ${idx + 1}`}
                    className="max-w-full h-auto object-contain max-h-[800px] border border-gray-200 p-2"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ))}
            </div>

            <div className="mt-8 text-xs text-gray-500">
              <p>
                Заказчик уведомлен, что отображение цветов на мониторах и
                мобильных устройствах может отличаться от выбранного декора.
                Цвет декора соответствует исключительно представленному образцу.
              </p>
              <br />
              <p>
                Заказчик подтверждает и согласен с эскизами и размерами
                указанными на нем, а также с информацией, указывающей на
                технические особенности элементов продукции.
              </p>
            </div>
          </div>
        )}

        {/* Page 2: Specification */}
        <div>
          <h1 className="text-xl font-bold mb-6 uppercase">
            Спецификация к договору № {setData.contractNumber} от{" "}
            {new Date(setData.contractDate).toLocaleDateString("ru-RU")}
          </h1>

          <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-2 gap-8 text-sm break-inside-avoid">
            <div>
              <p className="text-gray-500 mb-1">Сумма по договору:</p>
              <p className="font-bold text-xl">
                {(
                  (summary.totalMaterialsPrice || 0) +
                  (summary.totalHardwarePrice || 0) +
                  (summary.totalServicesPrice || 0)
                ).toLocaleString()}{" "}
                ₽
              </p>

              {setData.readyDate && !setData.useSeparateDates && (
                <div className="mt-4">
                  <p className="text-gray-500 mb-1">Дата готовности:</p>
                  <p className="font-bold text-lg">
                    {new Date(setData.readyDate).toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              )}
            </div>
            <div>
              <p className="font-bold mb-2 text-gray-700">Расшифровка цены:</p>
              <div className="space-y-1">
                <p className="flex justify-between">
                  <span className="text-gray-500">Продукция:</span>{" "}
                  <span className="font-medium">
                    {(summary.totalMaterialsPrice || 0).toLocaleString()} ₽
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-gray-500">Фурнитура/Товары:</span>{" "}
                  <span className="font-medium">
                    {(summary.totalHardwarePrice || 0).toLocaleString()} ₽
                  </span>
                </p>
                <p className="flex justify-between">
                  <span className="text-gray-500">Услуги производства:</span>{" "}
                  <span className="font-medium">
                    {(summary.totalServicesPrice || 0).toLocaleString()} ₽
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Projects Breakdown */}
          {projects.length > 0 && (
            <div className="mb-6 break-inside-avoid">
              <p className="font-bold mb-3 text-sm text-gray-700">
                Состав комплекта:
              </p>
              <div className="flex flex-col gap-3">
                {projects.map((p: any, idx: number) => {
                  let projSum = p.totalPrice || 0;
                  if (projSum === 0 && p.data?.summaryRows) {
                    projSum = p.data.summaryRows.reduce(
                      (acc: number, row: any) => acc + (row.total || 0),
                      0,
                    );
                  }
                  const projReadyDate =
                    setData.useSeparateDates && setData.perProjectDates?.[p.id]
                      ? new Date(
                          setData.perProjectDates[p.id],
                        ).toLocaleDateString("ru-RU", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : null;

                  return (
                    <div
                      key={p.id || idx}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-4"
                    >
                      <div>
                        <span className="text-sm font-bold text-gray-800">
                          {p.name || `Проект ${idx + 1}`}
                        </span>
                        {projReadyDate && (
                          <p className="text-xs text-gray-500 mt-1">
                            Готовность: {projReadyDate}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-bold">
                        {projSum.toLocaleString()} ₽
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border border-gray-200 rounded-xl overflow-hidden mb-6 shadow-sm break-inside-avoid">
            {/* General Info */}
            <div className="bg-yellow-50 p-3 border-b border-yellow-200 text-yellow-900 flex flex-col justify-center items-start gap-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">
                  Общая сумма:{" "}
                  {(
                    (summary.totalMaterialsPrice || 0) +
                    (summary.totalHardwarePrice || 0) +
                    (summary.totalServicesPrice || 0)
                  ).toLocaleString()}{" "}
                  ₽
                </span>
                <span className="text-xs font-medium opacity-75">
                  — Стоимость изделия, товаров и услуг
                </span>
              </div>
              {(summary.totalDeliveryPrice > 0 ||
                summary.totalAssemblyPrice > 0) && (
                <span className="text-xs font-medium opacity-75">
                  * Доставка и Сборка оплачиваются отдельно
                </span>
              )}
            </div>

            {/* Materials Block */}
            {projects.some((p: any) =>
              p.data?.summaryRows?.some(
                (r: any) => r.type === "material" || r.type === "edge",
              ),
            ) && (
              <div className="mb-4 break-inside-avoid">
                <div className="bg-blue-50 font-bold p-2 px-3 text-xs text-blue-900 rounded-t-xl border border-b-0 border-blue-100 flex items-center gap-2">
                  <div className="w-1.5 h-3 bg-blue-500 rounded-full"></div>
                  Материалы, кромка и фасады
                </div>
                <div className="border border-gray-200 rounded-b-xl px-4 py-3 bg-white text-[10px] space-y-3">
                  {projects.map((p: any, idx: number) => {
                    if (!p.data?.summaryRows) return null;
                    const items = p.data.summaryRows;
                    const mList: any[] = [];

                    const materials = items.filter(
                      (r: any) => r.type === "material",
                    );
                    const edges = items.filter((r: any) => r.type === "edge");
                    const pEdges = items.filter(
                      (r: any) => r.type === "product_edge",
                    );

                    materials.forEach((m: any) => {
                      if (m.name === "Комплект метизов") return;
                      let kind = "ЛДСП/МДФ (Корпус)";
                      if (m.name?.includes("Фасад")) {
                        kind =
                          "Фасады (" +
                          m.name.replace("Фасад ", "").replace(/[()]/g, "") +
                          ")";
                      } else if (
                        m.name?.toLowerCase().includes("хдф") ||
                        m.sub?.toLowerCase().includes("хдф")
                      ) {
                        kind = "ХДФ (Задняя стенка)";
                      } else if (m.name?.toLowerCase().includes("столешница")) {
                        kind = "Столешница/Панель";
                      }

                      const decorValue =
                        m.decor && m.decor !== "-" ? m.decor : m.sub || "";
                      mList.push({ kind, value: decorValue });
                    });

                    if (edges.length > 0) {
                      const edgeValues = Array.from(
                        new Set(
                          edges.map((e: any) =>
                            e.decor && e.decor !== "-" ? e.decor : e.name,
                          ),
                        ),
                      ).join(", ");
                      mList.push({ kind: "Кромка", value: edgeValues });
                    }

                    if (pEdges.length > 0) {
                      const pEdgeValues = Array.from(
                        new Set(
                          pEdges.map((e: any) =>
                            e.decor && e.decor !== "-" ? e.decor : e.name,
                          ),
                        ),
                      ).join(", ");
                      mList.push({
                        kind: "Кромка (Столешница/Панель)",
                        value: pEdgeValues,
                      });
                    }

                    if (mList.length === 0) return null;

                    return (
                      <div key={p.id}>
                        <div className="font-bold text-gray-800 mb-1">
                          {p.name}:
                        </div>
                        <ul className="list-disc pl-5 text-gray-600 space-y-0.5">
                          {mList.map((item, i) => (
                            <li key={i}>
                              <span className="font-medium text-gray-700">
                                {item.kind}:
                              </span>{" "}
                              {item.value}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Items Table */}
            {summary.hardware.filter((item: any) => item.name).length > 0 && (
              <div className="mb-4 break-inside-avoid">
                <div className="bg-indigo-50 font-bold p-2 px-3 text-xs text-indigo-900 rounded-t-xl border border-b-0 border-indigo-100 flex items-center gap-2">
                  <div className="w-1.5 h-3 bg-indigo-500 rounded-full"></div>
                  Товары и комплектующие
                </div>
                <div className="border border-gray-200 rounded-b-xl overflow-hidden">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[9px]">
                        <th className="text-left p-2 px-3 font-bold border-r border-gray-200 w-2/3">
                          Наименование
                        </th>
                        <th className="p-2 px-3 font-bold border-r border-gray-200 w-16 text-center">
                          Кол-во
                        </th>
                        <th className="p-2 px-3 font-bold border-r border-gray-200 w-24 text-right">
                          Цена
                        </th>
                        <th className="p-2 px-3 font-bold w-24 text-right">
                          Сумма
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {Array.from(
                        new Set(
                          summary.hardware
                            .filter((item: any) => item.name)
                            .map((h: any) => h.projectName),
                        ),
                      ).map((projectName: any, pIdx: number) => {
                        const projectHardware = summary.hardware.filter(
                          (item: any) =>
                            item.name && item.projectName === projectName,
                        );
                        if (projectHardware.length === 0) return null;
                        return (
                          <React.Fragment key={pIdx}>
                            <tr>
                              <td
                                colSpan={4}
                                className="p-2 px-3 bg-indigo-50/50 font-bold text-indigo-900 border-b border-indigo-100 text-[10px]"
                              >
                                {projectName || "Общее"}
                              </td>
                            </tr>
                            {projectHardware.map((item: any, idx: number) => (
                              <tr
                                key={`${pIdx}-${idx}`}
                                className="hover:bg-gray-50/50"
                              >
                                <td className="p-2 px-3 border-r border-gray-200 font-medium text-xs text-gray-800">
                                  {item.name}
                                </td>
                                <td className="p-2 px-3 border-r border-gray-200 text-center font-medium">
                                  {parseFloat(item.qty || 1)}{" "}
                                  {/шт|м|усл|л./.test(String(item.qty))
                                    ? ""
                                    : item.unit || "шт"}
                                </td>
                                <td className="p-2 px-3 border-r border-gray-200 text-right text-gray-500">
                                  {(item.price || 0).toLocaleString()}{" "}
                                  <span className="text-[9px]">₽</span>
                                </td>
                                <td className="p-2 px-3 text-right font-bold text-gray-900">
                                  {(
                                    item.total ||
                                    (item.price || 0) *
                                      parseFloat(item.qty || 1)
                                  ).toLocaleString()}{" "}
                                  <span className="text-[9px]">₽</span>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Services Table */}
            {(summary.services.length > 0 ||
              summary.totalDeliveryPrice > 0 ||
              summary.totalAssemblyPrice > 0) && (
              <div className="break-inside-avoid mb-4">
                <div className="bg-orange-50 font-bold p-2 px-3 text-xs text-orange-900 rounded-t-xl border border-b-0 border-orange-100 flex items-center gap-2 break-inside-avoid">
                  <div className="w-1.5 h-3 bg-orange-400 rounded-full"></div>
                  Услуги, доставка и сборка
                </div>
                <div className="border border-gray-200 rounded-b-xl overflow-hidden">
                  <table className="w-full text-[10px]">
                    <tbody className="divide-y divide-gray-100">
                      {Array.from(
                        new Set(
                          summary.services
                            .filter((item: any) => item.name)
                            .map((h: any) => h.projectName),
                        ),
                      ).map((projectName: any, pIdx: number) => {
                        const projectServices = summary.services.filter(
                          (item: any) =>
                            item.name && item.projectName === projectName,
                        );
                        if (projectServices.length === 0) return null;
                        return (
                          <React.Fragment key={pIdx}>
                            <tr>
                              <td
                                colSpan={4}
                                className="p-2 px-3 bg-orange-50/50 font-bold text-orange-900 border-b border-orange-100 text-[10px]"
                              >
                                {projectName || "Общее"}
                              </td>
                            </tr>
                            {projectServices.map((item: any, idx: number) => (
                              <tr
                                key={`${pIdx}-${idx}`}
                                className="hover:bg-gray-50/50"
                              >
                                <td className="p-2 px-3 border-r border-gray-200 w-2/3 font-medium text-xs text-gray-800">
                                  {item.name}
                                </td>
                                <td className="p-2 px-3 border-r border-gray-200 text-center font-medium w-16">
                                  {parseFloat(item.qty || 1)}{" "}
                                  {/шт|м|усл|л./.test(String(item.qty))
                                    ? ""
                                    : item.unit || "усл"}
                                </td>
                                <td className="p-2 px-3 border-r border-gray-200 text-right text-gray-500 w-24">
                                  {(item.price || 0).toLocaleString()}{" "}
                                  <span className="text-[9px]">₽</span>
                                </td>
                                <td className="p-2 px-3 text-right font-bold text-gray-900 w-24">
                                  {(
                                    item.total ||
                                    (item.price || 0) *
                                      parseFloat(item.qty || 1)
                                  ).toLocaleString()}{" "}
                                  <span className="text-[9px]">₽</span>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                      {!summary.services.some((s: any) =>
                        s.name?.includes("Доставка"),
                      ) &&
                        summary.totalDeliveryPrice > 0 && (
                          <tr>
                            <td
                              className="p-2 px-3 border-r border-gray-200 font-medium text-xs"
                              colSpan={3}
                            >
                              Доставка
                            </td>
                            <td className="p-2 px-3 text-right font-bold">
                              {summary.totalDeliveryPrice.toLocaleString()}{" "}
                              <span className="text-[9px]">₽</span>
                            </td>
                          </tr>
                        )}
                      {!summary.services.some((s: any) =>
                        s.name?.includes("сборк"),
                      ) &&
                        summary.totalAssemblyPrice > 0 && (
                          <tr>
                            <td
                              className="p-2 px-3 border-r border-gray-200 font-medium text-xs"
                              colSpan={3}
                            >
                              Сборка
                            </td>
                            <td className="p-2 px-3 text-right font-bold">
                              {summary.totalAssemblyPrice.toLocaleString()}{" "}
                              <span className="text-[9px]">₽</span>
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 text-xs text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-100 break-inside-avoid shadow-sm">
            <p className="font-bold mb-1">Согласование спецификации</p>
            <p>
              Заказчик подтверждает и согласен со Спецификацией к заказу.
              Внесенные изменения после подписания могут повлечь изменение
              стоимости и сроков.
            </p>
          </div>
        </div>
      </div>
      {/* Global print styles hidden in regular view */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          body * {
            visibility: hidden;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body, html {
            height: auto !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:bg-transparent, .print\\:bg-transparent * {
            visibility: visible;
          }
          .print\\:bg-transparent {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `,
        }}
      />
    </div>
  );
};
