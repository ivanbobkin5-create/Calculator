import React from 'react';
import { 
  Calculator, 
  LayoutDashboard, 
  Database, 
  ShoppingBag, 
  ChevronRight, 
  CheckCircle2,
  Factory,
  Users,
  ArrowRight
} from 'lucide-react';

export const LandingPage = ({ onLogin, onRegister }: { onLogin: () => void, onRegister: () => void }) => {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                <Calculator className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-black text-gray-900 tracking-tight">MebCalc <span className="text-blue-600">Pro</span></span>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={onLogin}
                className="text-sm font-bold text-gray-600 hover:text-blue-600 transition-colors"
              >
                Войти
              </button>
              <button 
                onClick={onRegister}
                className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
              >
                Начать бесплатно
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-bold mb-8 animate-bounce">
            <CheckCircle2 className="w-4 h-4" />
            Профессиональный инструмент для мебельщиков
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-gray-900 mb-6 tracking-tight leading-tight">
            Умный калькулятор для <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              мебельного бизнеса
            </span>
          </h1>
          <p className="text-xl text-gray-500 max-w-3xl mx-auto mb-10 leading-relaxed">
            Автоматизируйте расчеты, управляйте проектами и взаимодействуйте с производствами в единой экосистеме. От эскиза до готового изделия за считанные минуты.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={onRegister}
              className="w-full sm:w-auto px-10 py-4 bg-blue-600 text-white text-lg font-bold rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-2 group"
            >
              Зарегистрироваться <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={onLogin}
              className="w-full sm:w-auto px-10 py-4 bg-white text-gray-900 text-lg font-bold rounded-2xl border-2 border-gray-100 hover:border-blue-200 transition-all"
            >
              У меня есть аккаунт
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">Всё необходимое в одном месте</h2>
            <p className="text-gray-500">Мощные инструменты для каждого этапа вашего бизнеса</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-all group">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <Calculator className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Точный расчет</h3>
              <p className="text-gray-500 leading-relaxed">
                Учитывайте всё: от ЛДСП и кромки до фурнитуры и услуг. Гибкие настройки наценок и коэффициентов.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-all group">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <LayoutDashboard className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Управление проектами</h3>
              <p className="text-gray-500 leading-relaxed">
                Храните все расчеты в облаке. Отслеживайте статусы, прикрепляйте эскизы и спецификации.
              </p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-all group">
              <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-600 group-hover:text-white transition-all">
                <Factory className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Связь с производством</h3>
              <p className="text-gray-500 leading-relaxed">
                Передавайте заказы напрямую на производство. Получайте актуальные цены и сроки в реальном времени.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-white" id="pricing">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">Тарифы</h2>
            <p className="text-gray-500">У всех после регистрации есть 14 дней бесплатно.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Производство */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-all flex flex-col relative">
              <div className="absolute top-0 right-0 bg-blue-600 text-white px-4 py-1 rounded-bl-xl rounded-tr-3xl text-xs font-bold uppercase tracking-wider">Популярный</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Производство</h3>
              <div className="mb-6">
                <span className="text-4xl font-black text-gray-900">4 990 ₽</span>
                <span className="text-gray-500"> / мес</span>
              </div>
              <div className="text-sm text-green-600 font-medium mb-6 bg-green-50 px-3 py-1 rounded-lg inline-block self-start">
                При оплате на год скидка 30%
              </div>
              <div className="space-y-4 mb-8 flex-1">
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="text-gray-600">Включено: 5 мебельных салонов, 3 дизайнера, 10 сотрудников</span>
                </div>
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="text-gray-600">+1 сотрудник - 1000 рублей</span>
                </div>
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="text-gray-600">+1 салон - 2000 рублей</span>
                </div>
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="text-gray-600">+1 дизайнер - 1000 рублей</span>
                </div>
              </div>
              <button onClick={onRegister} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
                Начать бесплатно
              </button>
            </div>

            {/* Салон */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-all flex flex-col">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Салон</h3>
              <div className="mb-6">
                <span className="text-4xl font-black text-gray-900">7 990 ₽</span>
                <span className="text-gray-500"> / мес</span>
              </div>
              <div className="text-sm text-green-600 font-medium mb-6 bg-green-50 px-3 py-1 rounded-lg inline-block self-start">
                При оплате на год скидка 30%
              </div>
              <div className="space-y-4 mb-8 flex-1">
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="text-gray-600">Включено: 1 производство в городе присутствия, 5 сотрудников</span>
                </div>
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="text-gray-600">Каждый новый город + 3000 рублей</span>
                </div>
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="text-gray-600">+1 сотрудник - 1000 рублей</span>
                </div>
              </div>
              <button onClick={onRegister} className="w-full py-3 bg-gray-100 text-gray-900 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                Начать бесплатно
              </button>
            </div>

            {/* Дизайнер */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-all flex flex-col">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Дизайнер</h3>
              <div className="mb-6">
                <span className="text-4xl font-black text-gray-900">1 990 ₽</span>
                <span className="text-gray-500"> / мес</span>
              </div>
              <div className="text-sm text-green-600 font-medium mb-6 bg-green-50 px-3 py-1 rounded-lg inline-block self-start">
                При оплате на год скидка 30%
              </div>
              <div className="space-y-4 mb-8 flex-1">
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="text-gray-600">Включено: 1 производство в городе присутствия</span>
                </div>
                <div className="flex gap-3 items-start">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="text-gray-600">Каждый новый город + 1000 рублей</span>
                </div>
              </div>
              <button onClick={onRegister} className="w-full py-3 bg-gray-100 text-gray-900 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                Начать бесплатно
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1">
              <h2 className="text-4xl font-black text-gray-900 mb-8 leading-tight">
                Решения для любого <br />
                <span className="text-blue-600">типа компании</span>
              </h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Factory className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Мебельное производство</h4>
                    <p className="text-sm text-gray-500">Управляйте заказами от салонов, настраивайте прайсы и контролируйте работу цеха.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Мебельный салон</h4>
                    <p className="text-sm text-gray-500">Быстро считайте заказы клиентам, отправляйте заявки на производство и ведите базу проектов.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Частный дизайнер</h4>
                    <p className="text-sm text-gray-500">Профессиональный инструмент для точного расчета стоимости ваших идей.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 bg-blue-600 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl shadow-blue-200">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
              <div className="relative z-10">
                <h3 className="text-3xl font-bold mb-6">Готовы оптимизировать свой бизнес?</h3>
                <p className="text-blue-100 mb-8 text-lg">Присоединяйтесь к сотням профессионалов, которые уже используют MebCalc Pro для роста своего дела.</p>
                <button 
                  onClick={onRegister}
                  className="px-8 py-4 bg-white text-blue-600 font-black rounded-2xl hover:bg-blue-50 transition-all shadow-lg"
                >
                  Попробовать бесплатно
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <Calculator className="text-white w-5 h-5" />
            </div>
            <span className="text-lg font-black text-gray-900 tracking-tight">MebCalc <span className="text-blue-600">Pro</span></span>
          </div>
          <p className="text-gray-400 text-sm">© 2026 MebCalc Pro. Все права защищены.</p>
        </div>
      </footer>
    </div>
  );
};
