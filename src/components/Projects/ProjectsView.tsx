import React, { useState, useEffect } from 'react';
import { FolderOpen, Search, Calendar, User, ArrowRight, Trash2, Edit2, FileText, ClipboardList } from 'lucide-react';
import { cn } from '../../lib/utils';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { collection, onSnapshot, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { ProjectSpecificationModal } from './ProjectSpecificationModal';

interface Project {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  data: any;
  status?: 'draft' | 'sent' | 'transferred';
  sketches?: string[];
  specification?: any;
  sourceCompanyId?: string;
  sourceProjectId?: string;
  transferredAt?: string;
}

export const ProjectsView = ({ 
  companyId, 
  userId, 
  userRole, 
  onLoadProject,
  onOpenSpecification,
  companyType,
  manufacturerId,
  showConfirm
}: { 
  companyId?: string; 
  userId?: string; 
  userRole?: string;
  onLoadProject: (project: Project) => void;
  onOpenSpecification: (project: Project) => void;
  companyType?: string;
  manufacturerId?: string;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'draft' | 'sent' | 'transferred'>('all');

  useEffect(() => {
    if (!companyId) return;

    let q;
    if (userRole === 'admin') {
      // Admin sees all projects of the company
      q = query(
        collection(db, 'companies', companyId, 'projects'),
        orderBy('createdAt', 'desc')
      );
    } else {
      // Employees see only their own projects
      q = query(
        collection(db, 'companies', companyId, 'projects'),
        where('createdBy', '==', userId),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      setProjects(projs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `companies/${companyId}/projects`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [companyId, userId, userRole]);

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!companyId) return;
    
    showConfirm('Удаление проекта', 'Вы уверены, что хотите удалить этот проект?', async () => {
      try {
        await deleteDoc(doc(db, 'companies', companyId, 'projects', projectId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `companies/${companyId}/projects/${projectId}`);
      }
    });
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.createdByName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeFilter === 'all') return matchesSearch;
    return matchesSearch && (p.status || 'draft') === activeFilter;
  });

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Проекты</h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full md:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Поиск..."
              />
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl">
              {(['all', 'draft', 'sent', 'transferred'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activeFilter === filter ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {filter === 'all' ? 'Все' : 
                   filter === 'draft' ? 'Черновики' : 
                   filter === 'sent' ? 'Оформленные' : 'Переданные'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-gray-100 text-center shadow-sm">
            <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Проектов не найдено</h2>
            <p className="text-gray-500">В этой категории пока нет проектов</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div 
                key={project.id}
                onClick={() => onLoadProject(project)}
                className="group bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => handleDelete(e, project.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-start gap-4 mb-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all",
                    project.status === 'sent' ? "bg-orange-50 text-orange-600" :
                    project.status === 'transferred' ? "bg-green-50 text-green-600" :
                    "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
                  )}>
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                        {project.name}
                      </h3>
                      {project.status && project.status !== 'draft' && (
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider",
                          project.status === 'sent' ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
                        )}>
                          {project.status === 'sent' ? 'Оформлен' : 'Передан'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" />
                      {new Date(project.createdAt).toLocaleDateString('ru-RU', { 
                        day: 'numeric', 
                        month: 'short', 
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-500">
                      {project.createdByName?.charAt(0) || 'U'}
                    </div>
                    <span className="text-xs text-gray-500 font-medium truncate max-w-[120px]">
                      {project.createdByName || 'Пользователь'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(userRole === 'manager' || userRole === 'admin') && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSpecification(project);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all flex items-center gap-1 text-[10px] font-bold"
                      >
                        <ClipboardList className="w-4 h-4" />
                        {project.status === 'sent' || project.status === 'transferred' ? 'Спецификация' : 'Оформить'}
                      </button>
                    )}
                    <div className="flex items-center gap-1 text-blue-600 text-xs font-bold group-hover:translate-x-1 transition-transform">
                      Открыть <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
