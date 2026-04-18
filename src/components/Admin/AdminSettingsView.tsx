import React, { useState, useEffect } from 'react';
import { Users, Plus, Shield, Mail, User, Briefcase, Settings, Trash2, Edit2, X, Check, Loader2, Lock, Crown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { db } from '../../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDoc, query, where } from 'firebase/firestore';
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

export const AdminSettingsView = ({ 
  companyId, 
  currentUserId,
  showAlert,
  showConfirm,
  showPrompt
}: { 
  companyId?: string, 
  currentUserId?: string,
  showAlert: (title: string, message: string) => void,
  showConfirm: (title: string, message: string, onConfirm: () => void) => void,
  showPrompt: (title: string, message: string, defaultValue: string, onConfirm: (value: string) => void) => void
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companyData, setCompanyData] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({
    accessLevel: 'worker'
  });
  const [showTariffModal, setShowTariffModal] = useState(false);
  const [tariffRequests, setTariffRequests] = useState<any[]>([]);
  const [tariffRequest, setTariffRequest] = useState({
    type: 'Производство',
    period: 'month',
    extraSalons: 0,
    extraDesigners: 0,
    extraEmployees: 0,
    extraCities: 0
  });

  useEffect(() => {
    if (!companyId) return;

    const unsubscribeEmployees = onSnapshot(collection(db, 'companies', companyId, 'employees'), (snapshot) => {
      const emps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(emps);
    });

    const unsubscribeCompany = onSnapshot(doc(db, 'companies', companyId), (docSnap) => {
      if (docSnap.exists()) {
        setCompanyData(docSnap.data());
      }
    });

    const unsubscribeRequests = onSnapshot(
      query(collection(db, 'tariffRequests'), where('companyId', '==', companyId)),
      (snapshot) => {
        const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        setTariffRequests(reqs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
    );

    return () => {
      unsubscribeEmployees();
      unsubscribeCompany();
      unsubscribeRequests();
    };
  }, [companyId]);

  const handleTariffRequest = async () => {
    if (!companyId) return;
    try {
      await setDoc(doc(db, 'tariffRequests', Date.now().toString()), {
        companyId,
        companyName: companyData?.name,
        request: tariffRequest,
        createdAt: new Date().toISOString(),
        status: 'pending'
      });
      setShowTariffModal(false);
      showAlert('Заявка отправлена', 'Ваша заявка на продление тарифа отправлена администратору. Мы свяжемся с вами в ближайшее время.');
    } catch (error) {
      console.error("Error sending tariff request:", error);
      showAlert('Ошибка', 'Не удалось отправить заявку');
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setError(null);
    setIsLoading(true);

    if (newEmployee.name && newEmployee.email && newEmployee.role && newEmployee.accessLevel) {
      try {
        const trimmedEmail = newEmployee.email.trim().toLowerCase();
        let uid = editingId;

        // If it's a new employee, create them in Firebase Auth first
        if (!editingId) {
          try {
            const userCredential = await createUserWithEmailAndPassword(
              secondaryAuth,
              trimmedEmail,
              '123456' // Default password
            );
            uid = userCredential.user.uid;
            // Sign out from secondary app immediately to avoid session conflicts
            await secondaryAuth.signOut();
          } catch (authError: any) {
            if (authError.code === 'auth/email-already-in-use') {
              setError('Пользователь с таким Email уже существует в системе. Если вы хотите привязать его, используйте существующий UID или обратитесь в поддержку.');
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
          email: trimmedEmail,
          role: newEmployee.accessLevel,
          companyId: companyId,
          createdAt: new Date().toISOString()
        };

        // 1. Create/Update in global 'users' collection (for auth and rules)
        await setDoc(doc(db, 'users', uid), employeeData);

        // 2. Create/Update in company 'employees' collection (for listing in admin panel)
        await setDoc(doc(db, 'companies', companyId, 'employees', uid), {
          name: newEmployee.name,
          email: trimmedEmail,
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
    if (id === currentUserId) {
      showAlert('Ошибка', 'Вы не можете удалить самого себя');
      return;
    }
    
    showConfirm('Удаление сотрудника', 'Вы уверены, что хотите удалить сотрудника? Доступ в систему будет заблокирован.', async () => {
      try {
        // 1. Delete from company employees list
        await deleteDoc(doc(db, 'companies', companyId, 'employees', id));
        // 2. Delete from global users (this revokes permissions in security rules)
        await deleteDoc(doc(db, 'users', id));
      } catch (error) {
        console.error("Error deleting employee:", error);
      }
    });
  };

  const changePassword = (employee: Employee) => {
    showPrompt('Смена пароля', `Введите новый пароль для ${employee.name}:`, '123456', (newPass) => {
      if (newPass) {
        showAlert('Сброс пароля', 'Пароль будет изменен. В данной версии это имитация. В реальности требуется использование Admin SDK или сброс через Email.');
      }
    });
  };

  const restoreAccess = async (employee: Employee) => {
    if (!companyId) return;
    
    showConfirm('Восстановление доступа', `Вы хотите восстановить доступ для ${employee.name}? Это создаст учетную запись в Auth, если она отсутствует, с паролем 123456.`, async () => {
      setIsLoading(true);
      setError(null);
      try {
        const trimmedEmail = employee.email.trim().toLowerCase();
        try {
          const userCredential = await createUserWithEmailAndPassword(
            secondaryAuth,
            trimmedEmail,
            '123456'
          );
          const uid = userCredential.user.uid;
          await secondaryAuth.signOut();

          // Update UID if it changed (though it shouldn't if we use email as key)
          const employeeData = {
            uid: uid,
            name: employee.name,
            email: trimmedEmail,
            role: employee.accessLevel,
            companyId: companyId,
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', uid), employeeData);
          showAlert('Успех', 'Доступ успешно восстановлен. Пароль: 123456');
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            showAlert('Информация', 'Учетная запись уже существует. Попробуйте войти с паролем 123456 или сбросить его через Firebase Console.');
          } else {
            throw authError;
          }
        }
      } catch (error: any) {
        console.error("Error restoring access:", error);
        setError('Ошибка при восстановлении доступа: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    });
  };

  const startEdit = (emp: Employee) => {
    setNewEmployee(emp);
    setEditingId(emp.id);
    setIsAdding(true);
  };

  const makeProjectManager = (employee: Employee) => {
    if (!companyId) return;
    showConfirm('Назначить руководителя', `Сотрудник ${employee.name} получит должность 'Руководитель проекта' и полный доступ к системе (как администратор). Продолжить?`, async () => {
      try {
        await setDoc(doc(db, 'users', employee.id), {
          uid: employee.id,
          name: employee.name,
          email: employee.email,
          role: 'admin',
          companyId: companyId,
          createdAt: employee.createdAt || new Date().toISOString()
        });

        await setDoc(doc(db, 'companies', companyId, 'employees', employee.id), {
          ...employee,
          role: 'Руководитель проекта',
          accessLevel: 'admin'
        });
        showAlert('Успешно', `Сотрудник ${employee.name} назначен руководителем проекта.`);
      } catch (error: any) {
        console.error("Error making project manager:", error);
        showAlert('Ошибка', 'Не удалось назначить руководителя: ' + error.message);
      }
    });
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Tariff Info Section */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Ваш тариф</h2>
              <div className="flex items-center gap-2 text-gray-600">
                <span className="font-medium text-gray-900">{companyData?.type || 'Не указан'}</span>
                <span>•</span>
                <span>
                  Действует до:{' '}
                  {companyData?.tariffExpiration ? (
                    <span className={cn(
                      "font-bold",
                      new Date(companyData.tariffExpiration) < new Date() ? "text-red-600" : "text-green-600"
                    )}>
                      {new Date(companyData.tariffExpiration).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-gray-400">Не указано</span>
                  )}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowTariffModal(true)}
              className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
            >
              Продлить тариф
            </button>
          </div>

          {tariffRequests.filter(r => r.status === 'pending').length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">Активные заявки</h3>
              <div className="space-y-3">
                {tariffRequests.filter(r => r.status === 'pending').map(req => (
                  <div key={req.id} className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-blue-900">Заявка от {new Date(req.createdAt).toLocaleDateString()}</div>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-md">В обработке</span>
                    </div>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p>Тариф: {req.request.type} ({req.request.period === 'year' ? '1 год' : '1 месяц'})</p>
                      {req.request.extraEmployees > 0 && <p>Доп. сотрудники: {req.request.extraEmployees}</p>}
                      {req.request.extraSalons > 0 && <p>Доп. салоны: {req.request.extraSalons}</p>}
                      {req.request.extraDesigners > 0 && <p>Доп. дизайнеры: {req.request.extraDesigners}</p>}
                      {req.request.extraCities > 0 && <p>Доп. города: {req.request.extraCities}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Employees Section */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
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
                      onClick={() => changePassword(employee)}
                      className="text-orange-600 hover:text-orange-900 mr-4"
                      title="Сменить пароль"
                    >
                      <Lock className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => restoreAccess(employee)}
                      className="text-green-600 hover:text-green-900 mr-4"
                      title="Восстановить доступ / Создать Auth аккаунт"
                    >
                      <Shield className="w-4 h-4" />
                    </button>
                    {employee.accessLevel !== 'admin' && (
                      <button 
                        onClick={() => makeProjectManager(employee)}
                        className="text-purple-600 hover:text-purple-900 mr-4"
                        title="Назначить руководителем проекта (Полный доступ)"
                      >
                        <Crown className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => startEdit(employee)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {employee.id !== currentUserId && (
                      <button 
                        onClick={() => removeEmployee(employee.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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

      {/* Tariff Modal */}
      {showTariffModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Продление тарифа</h2>
              <button onClick={() => setShowTariffModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Выберите тариф</label>
                <select 
                  value={tariffRequest.type}
                  onChange={(e) => setTariffRequest(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Производство">Производство (4990 ₽/мес)</option>
                  <option value="Салон">Салон (7990 ₽/мес)</option>
                  <option value="Дизайнер">Дизайнер (1990 ₽/мес)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Период оплаты</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setTariffRequest(prev => ({ ...prev, period: 'month' }))}
                    className={cn(
                      "py-3 px-4 rounded-xl border text-center transition-colors",
                      tariffRequest.period === 'month' 
                        ? "border-blue-600 bg-blue-50 text-blue-700 font-medium" 
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    )}
                  >
                    1 месяц
                  </button>
                  <button
                    onClick={() => setTariffRequest(prev => ({ ...prev, period: 'year' }))}
                    className={cn(
                      "py-3 px-4 rounded-xl border text-center transition-colors relative",
                      tariffRequest.period === 'year' 
                        ? "border-blue-600 bg-blue-50 text-blue-700 font-medium" 
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    )}
                  >
                    1 год
                    <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      -30%
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Дополнительные опции</h3>
                
                {tariffRequest.type === 'Производство' && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Доп. сотрудники (+1000 ₽)</span>
                      <input 
                        type="number" 
                        min="0"
                        value={tariffRequest.extraEmployees}
                        onChange={(e) => setTariffRequest(prev => ({ ...prev, extraEmployees: parseInt(e.target.value) || 0 }))}
                        className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-center"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Доп. салоны (+2000 ₽)</span>
                      <input 
                        type="number" 
                        min="0"
                        value={tariffRequest.extraSalons}
                        onChange={(e) => setTariffRequest(prev => ({ ...prev, extraSalons: parseInt(e.target.value) || 0 }))}
                        className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-center"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Доп. дизайнеры (+1000 ₽)</span>
                      <input 
                        type="number" 
                        min="0"
                        value={tariffRequest.extraDesigners}
                        onChange={(e) => setTariffRequest(prev => ({ ...prev, extraDesigners: parseInt(e.target.value) || 0 }))}
                        className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-center"
                      />
                    </div>
                  </>
                )}

                {tariffRequest.type === 'Салон' && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Доп. сотрудники (+1000 ₽)</span>
                      <input 
                        type="number" 
                        min="0"
                        value={tariffRequest.extraEmployees}
                        onChange={(e) => setTariffRequest(prev => ({ ...prev, extraEmployees: parseInt(e.target.value) || 0 }))}
                        className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-center"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Доп. города (+3000 ₽)</span>
                      <input 
                        type="number" 
                        min="0"
                        value={tariffRequest.extraCities}
                        onChange={(e) => setTariffRequest(prev => ({ ...prev, extraCities: parseInt(e.target.value) || 0 }))}
                        className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-center"
                      />
                    </div>
                  </>
                )}

                {tariffRequest.type === 'Дизайнер' && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Доп. города (+1000 ₽)</span>
                    <input 
                      type="number" 
                      min="0"
                      value={tariffRequest.extraCities}
                      onChange={(e) => setTariffRequest(prev => ({ ...prev, extraCities: parseInt(e.target.value) || 0 }))}
                      className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-center"
                    />
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-gray-100">
                <button
                  onClick={handleTariffRequest}
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Отправить заявку
                </button>
                <p className="text-xs text-center text-gray-500 mt-3">
                  Менеджер свяжется с вами для подтверждения и оплаты
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};
