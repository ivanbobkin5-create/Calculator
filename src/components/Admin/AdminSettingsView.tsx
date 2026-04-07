import React, { useState, useEffect } from 'react';
import { Users, Plus, Shield, Mail, User, Briefcase, Settings, Trash2, Edit2, X, Check, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { db } from '../../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';

// Initialize a secondary Firebase app to manage employee accounts without logging out the admin
const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
const secondaryAuth = getAuth(secondaryApp);

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  accessLevel: 'admin' | 'manager' | 'worker';
}

export const AdminSettingsView = ({ companyId }: { companyId?: string }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({
    accessLevel: 'worker'
  });

  useEffect(() => {
    if (!companyId) return;

    const unsubscribe = onSnapshot(collection(db, 'companies', companyId, 'employees'), (snapshot) => {
      const emps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(emps);
    });

    return () => unsubscribe();
  }, [companyId]);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setError(null);
    setIsLoading(true);

    if (newEmployee.name && newEmployee.email && newEmployee.role && newEmployee.accessLevel) {
      try {
        let uid = editingId;

        // If it's a new employee, create them in Firebase Auth first
        if (!editingId) {
          try {
            const userCredential = await createUserWithEmailAndPassword(
              secondaryAuth,
              newEmployee.email,
              '123456' // Default password
            );
            uid = userCredential.user.uid;
            // Sign out from secondary app immediately to avoid session conflicts
            await secondaryAuth.signOut();
          } catch (authError: any) {
            if (authError.code === 'auth/email-already-in-use') {
              setError('Пользователь с таким Email уже существует в системе.');
              setIsLoading(false);
              return;
            }
            throw authError;
          }
        }

        if (!uid) throw new Error('UID is missing');

        const employeeData = {
          uid: uid,
          name: newEmployee.name,
          email: newEmployee.email,
          role: newEmployee.accessLevel, // This is for the 'users' collection (admin/manager/worker)
          companyId: companyId,
          createdAt: new Date().toISOString()
        };

        // 1. Create/Update in global 'users' collection (for auth and rules)
        await setDoc(doc(db, 'users', uid), employeeData);

        // 2. Create/Update in company 'employees' collection (for listing in admin panel)
        await setDoc(doc(db, 'companies', companyId, 'employees', uid), {
          name: newEmployee.name,
          email: newEmployee.email,
          role: newEmployee.role, // This is the job title (e.g. "Менеджер проектов")
          accessLevel: newEmployee.accessLevel
        });

        setIsAdding(false);
        setEditingId(null);
        setNewEmployee({ accessLevel: 'worker' });
      } catch (error: any) {
        console.error("Error saving employee:", error);
        setError('Ошибка при сохранении сотрудника: ' + (error.message || 'Неизвестная ошибка'));
      } finally {
        setIsLoading(false);
      }
    }
  };

  const removeEmployee = async (id: string) => {
    if (!companyId) return;
    if (!window.confirm('Вы уверены, что хотите удалить сотрудника? Доступ в систему будет заблокирован.')) return;
    
    try {
      // 1. Delete from company employees list
      await deleteDoc(doc(db, 'companies', companyId, 'employees', id));
      // 2. Delete from global users (this revokes permissions in security rules)
      await deleteDoc(doc(db, 'users', id));
    } catch (error) {
      console.error("Error deleting employee:", error);
    }
  };

  const startEdit = (emp: Employee) => {
    setNewEmployee(emp);
    setEditingId(emp.id);
    setIsAdding(true);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Сотрудники</h1>
          </div>
          {!isAdding && (
            <button
              onClick={() => {
                setIsAdding(true);
                setEditingId(null);
                setNewEmployee({ accessLevel: 'worker' });
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Добавить сотрудника
            </button>
          )}
        </div>

        {isAdding && (
          <div className="mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingId ? 'Редактировать сотрудника' : 'Новый сотрудник'}
            </h2>
            
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleAddEmployee} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ФИО</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={newEmployee.name || ''}
                    onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Петров Петр"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email (Логин)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    required
                    disabled={!!editingId}
                    value={newEmployee.email || ''}
                    onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder="worker@company.ru"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Должность</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Briefcase className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={newEmployee.role || ''}
                    onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Менеджер проектов"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Уровень доступа</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Shield className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    required
                    value={newEmployee.accessLevel || 'worker'}
                    onChange={(e) => setNewEmployee({ ...newEmployee, accessLevel: e.target.value as any })}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 sm:text-sm appearance-none bg-white"
                  >
                    <option value="admin">Администратор (Полный доступ)</option>
                    <option value="manager">Менеджер (Создание заказов)</option>
                    <option value="worker">Сотрудник (Только просмотр)</option>
                  </select>
                </div>
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Обновить' : 'Сохранить'}
                </button>
              </div>
            </form>
            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-700">
              <p className="font-bold mb-1">Важно:</p>
              <p>Сотрудники могут войти в кабинет, используя свой Email и пароль по умолчанию: <span className="font-mono font-bold">123456</span>. Рекомендуется сменить пароль после первого входа.</p>
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Сотрудник</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Должность</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Доступ</th>
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Действия</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium text-sm">
                          {employee.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                        <div className="text-sm text-gray-500">{employee.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{employee.role}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      "px-2 inline-flex text-xs leading-5 font-semibold rounded-full",
                      employee.accessLevel === 'admin' ? "bg-purple-100 text-purple-800" :
                      employee.accessLevel === 'manager' ? "bg-blue-100 text-blue-800" :
                      "bg-green-100 text-green-800"
                    )}>
                      {employee.accessLevel === 'admin' ? 'Администратор' :
                       employee.accessLevel === 'manager' ? 'Менеджер' : 'Сотрудник'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => startEdit(employee)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => removeEmployee(employee.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {employees.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              Нет добавленных сотрудников
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
