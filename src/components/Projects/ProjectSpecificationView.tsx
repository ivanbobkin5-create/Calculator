import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  Image as ImageIcon, 
  Upload, 
  Send, 
  Truck, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { SketchAnnotator } from './SketchAnnotator';

interface Project {
  id: string;
  name: string;
  data: any;
  status?: 'draft' | 'sent' | 'transferred';
  sketches?: string[];
  specification?: any;
  companyId?: string;
}

export const ProjectSpecificationView = ({ 
  project, 
  onClose, 
  userRole,
  companyId,
  manufacturerId
}: { 
  project: Project; 
  onClose: () => void;
  userRole: string;
  companyId: string;
  manufacturerId?: string;
}) => {
  const [sketches, setSketches] = useState<string[]>(project.sketches || []);
  const [selectedSketch, setSelectedSketch] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRemoveSketch = (index: number) => {
    setSketches(prev => prev.filter((_, i) => i !== index));
  };

  const handleTransferAnnotatedSketch = (annotatedImageUrl: string) => {
    setSketches(prev => prev.map(s => s === selectedSketch ? annotatedImageUrl : s));
    setSelectedSketch(null);
  };

  const handleSendProject = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'companies', companyId, 'projects', project.id), {
        status: 'sent',
        sketches: sketches,
        specification: project.data, // In a real app, this would be a refined spec
        sentAt: serverTimestamp()
      });
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `companies/${companyId}/projects/${project.id}`);
      setError('Ошибка при отправке проекта');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferToProduction = async () => {
    if (!manufacturerId) {
      setError('У вашей компании не выбрано производство в настройках');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      // 1. Update status in source company
      await updateDoc(doc(db, 'companies', companyId, 'projects', project.id), {
        status: 'transferred',
        transferredAt: serverTimestamp()
      });

      // 2. Create project in production company
      await addDoc(collection(db, 'companies', manufacturerId, 'projects'), {
        name: `${project.name} (от ${project.companyId || 'Салона'})`,
        createdAt: new Date().toISOString(),
        createdBy: project.id, // Reference to source
        createdByName: 'Система (Перенос)',
        data: project.data,
        status: 'draft',
        sourceCompanyId: companyId,
        sourceProjectId: project.id,
        sketches: sketches,
        specification: project.data
      });

      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `companies/${manufacturerId}/projects`);
      setError('Ошибка при передаче проекта на производство');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File upload triggered', event.target.files);
    const file = event.target.files?.[0];
    if (file) {
      console.log('File selected:', file.name, file.type);
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setSketches(prev => [...prev, url]);
      };
      reader.readAsDataURL(file);
      event.target.value = ''; // Reset input
    } else {
      console.log('No file selected');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <FileText className="text-white w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">Спецификация проекта</h2>
              <p className="text-xs text-gray-500">{project.name}</p>
            </div>
          </div>
          <button 
            onClick={selectedSketch ? () => setSelectedSketch(null) : onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {selectedSketch ? (
          <div className="p-8">
            <SketchAnnotator imageUrl={selectedSketch} onSave={handleTransferAnnotatedSketch} />
          </div>
        ) : (
          <div className="p-8 space-y-8">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl flex items-center gap-3 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Specification Content */}
            <section>
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Детализация заказа</h3>
              <div className="bg-gray-50 rounded-3xl border border-gray-100 p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <SpecItem label="Материал" value={project.data?.decor || 'Не указан'} />
                  <SpecItem label="Кромка" value={project.data?.edge || 'Не указана'} />
                  <SpecItem label="Фасады" value={project.data?.facades || 'Не указаны'} />
                  <SpecItem label="Фурнитура" value="Комплект метизов" />
                </div>
              </div>
            </section>

            {/* Sketches Section */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Эскизы и чертежи</h3>
                <label className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer">
                  <Upload className="w-4 h-4" /> Загрузить
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {sketches.map((url, index) => (
                  <div key={index} className="relative group aspect-square rounded-2xl overflow-hidden border border-gray-100 shadow-sm cursor-pointer" onClick={() => setSelectedSketch(url)}>
                    <img src={url} alt={`Sketch ${index + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    {userRole !== 'admin' && project.status === 'draft' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleRemoveSketch(index); }}
                        className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {sketches.length === 0 && (
                  <div className="col-span-full py-12 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-gray-400">
                    <ImageIcon className="w-10 h-10 mb-2 opacity-20" />
                    <p className="text-sm font-medium">Эскизы не добавлены</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {!selectedSketch && (
          <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={() => {
                  // PDF export logic
                  console.log('Export PDF');
                }}
                className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700"
              >
                Сохранить PDF
              </button>
              <button 
                onClick={handleSendProject}
                disabled={isSubmitting}
                className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700"
              >
                Передать
              </button>
            </div>
            <div className="text-sm text-gray-500">
              Статус: <span className={cn(
                "font-bold",
                project.status === 'sent' ? "text-orange-600" :
                project.status === 'transferred' ? "text-green-600" : "text-blue-600"
              )}>
                {project.status === 'sent' ? 'Оформлен' : 
                 project.status === 'transferred' ? 'Передан в производство' : 'Черновик'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SpecItem = ({ label, value }: { label: string, value: string }) => (
  <div>
    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">{label}</label>
    <p className="text-sm font-bold text-gray-900 truncate">{value}</p>
  </div>
);
