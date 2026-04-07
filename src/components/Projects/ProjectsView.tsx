import React, { useState, useEffect } from 'react';
import { FolderOpen, Search, Calendar, User, ArrowRight, Trash2, Edit2, FileText } from 'lucide-react';
import { cn } from '../../lib/utils';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { collection, onSnapshot, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';

interface Project {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  data: any;
}

export const ProjectsView = ({ 
  companyId, 
  userId, 
  userRole, 
  onLoadProject 
}: { 
  companyId?: string; 
  userId?: string; 
  userRole?: string;
  onLoadProject: (project: Project) => void;
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

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
    if (!window.confirm('Вы уверены, что хотите удалить этот проект?')) return;

    try {
      await deleteDoc(doc(db, 'companies', companyId, 'projects', projectId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `companies/${companyId}/projects/${projectId}`);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.createdByName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Проекты</h1>
          </div>
          
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Поиск по названию или автору..."
            />
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
            <p className="text-gray-500">Создайте новый расчет в калькуляторе и сохраните его</p>
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
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                      {project.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(project.createdAt).toLocaleDateString('ru-RU', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
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
                  <div className="flex items-center gap-1 text-blue-600 text-xs font-bold group-hover:translate-x-1 transition-transform">
                    Открыть <ArrowRight className="w-3 h-3" />
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
