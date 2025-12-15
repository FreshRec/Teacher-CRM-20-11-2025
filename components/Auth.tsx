import React, { useState, useEffect } from 'react';
import { api, getApiUrl } from '../services/api';

// Получаем текущий активный URL (из env или localStorage)
const API_URL = getApiUrl();

export function UpdatePassword({ onSuccess }: { onSuccess: () => void }) {
  return (
    <div className="text-center p-8 bg-white rounded shadow">
      Функция смены пароля не реализована в текущем бэкенде.
      <button onClick={onSuccess} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded">Вернуться</button>
    </div>
  );
}

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  
  const [serverStatus, setServerStatus] = useState<{ version?: string, status?: string, error?: string } | null>(null);
  const [manualUrl, setManualUrl] = useState('');

  // Проверка: сайт не локальный, а API указывает на localhost
  const isProductionButUsingLocalhost = typeof window !== 'undefined' && 
      window.location.hostname !== 'localhost' && 
      window.location.hostname !== '127.0.0.1' && 
      API_URL.includes('localhost');

  const checkServer = async () => {
      try {
          const res = await fetch(`${API_URL}/`);
          if (res.ok) {
              const data = await res.json();
              setServerStatus(data);
          } else {
              setServerStatus({ error: `Ошибка ${res.status}: ${res.statusText}` });
          }
      } catch (e: any) {
          setServerStatus({ error: e.message });
      }
  };
  
  useEffect(() => {
      // Автоматическая проверка при загрузке, чтобы пользователь сразу видел, жив ли сервер
      checkServer();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
        let result;
        if (isSignUp) {
            result = await api.auth.signUp({ email, password });
        } else {
            result = await api.auth.signInWithPassword({ email, password });
        }
        
        if (result.error) {
             throw result.error;
        }

        if (isSignUp) {
            setMessage({ text: 'Регистрация успешна! Теперь вы можете войти.', type: 'success' });
            setIsSignUp(false);
        } else {
             window.location.reload();
        }
    } catch (error) {
        let errorMessage = (error as Error).message || 'Ошибка авторизации';
        
        // Обработка ошибки сети (Load failed / Failed to fetch)
        if (errorMessage === 'Failed to fetch' || errorMessage === 'Load failed') {
            errorMessage = `Нет соединения с сервером. \nПроверьте адрес API: ${API_URL}`;
        }
        
        // Обработка ошибки DNS (база данных недоступна)
        if (typeof errorMessage === 'string') {
            if ((errorMessage.includes('getaddrinfo ENOTFOUND') || errorMessage.includes('getaddrinfo EAI_AGAIN')) && 
               errorMessage.includes('mdb.yandexcloud.net')) {
                errorMessage = `Ошибка подключения к Базе Данных (DNS).\n\nСервер не видит хост базы данных.\n\nКАК ИСПРАВИТЬ:\n1. Yandex Cloud -> Managed Service for PostgreSQL -> Кластер.\n2. Меню "Хосты" (Hosts).\n3. Нажмите "Изменить" у хоста.\n4. Включите "Публичный доступ".`;
            } 
            else if (errorMessage.includes('self-signed certificate in certificate chain')) {
                errorMessage = `Ошибка SSL сертификата Базы Данных.\n\nБэкенд не доверяет сертификату Yandex Cloud.\n\nРЕШЕНИЕ:\nОбновление кода (SSL Fix) уже загружено в репозиторий.\n\nВАЖНО: Вам нужно запустить новый деплой (GitHub Actions), чтобы обновить сервер в облаке.\n\nТекущая версия сервера: ${serverStatus?.version || 'Неизвестно (старая)'}`;
            }
        }
        
        setMessage({ text: errorMessage, type: 'error' });
    } finally {
        setLoading(false);
    }
  };

  const saveManualUrl = () => {
      if (!manualUrl) return;
      let url = manualUrl.trim();
      if (url.endsWith('/')) url = url.slice(0, -1);
      
      localStorage.setItem('teacher_crm_api_url', url);
      window.location.reload();
  };
  
  const resetManualUrl = () => {
      localStorage.removeItem('teacher_crm_api_url');
      window.location.reload();
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-indigo-600 mb-2 text-center">Teacher's CRM</h1>
        
        <div className="text-xs text-center text-gray-500 mb-2 font-mono bg-gray-50 p-2 rounded break-all border border-gray-200">
            Сервер API: {API_URL}
        </div>
        
        {/* Индикатор статуса сервера */}
        <div className="mb-6 text-center">
             {serverStatus?.version ? (
                 <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                     ✅ Сервер доступен (v{serverStatus.version})
                 </span>
             ) : serverStatus?.error ? (
                 <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800" title={serverStatus.error}>
                     ❌ Сервер недоступен
                 </span>
             ) : (
                 <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                     ⏳ Проверка связи...
                 </span>
             )}
             <button onClick={checkServer} className="ml-2 text-xs text-indigo-600 underline">Обновить</button>
        </div>

        {isProductionButUsingLocalhost && (
             <div className="mb-6 p-4 rounded text-sm bg-yellow-50 text-yellow-900 border border-yellow-200 shadow-sm">
                <h3 className="font-bold mb-2 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    Требуется настройка
                </h3>
                <p className="mb-3">
                    Сайт не видит сервер (ссылается на localhost).
                </p>
                
                <div className="bg-white p-3 rounded border border-yellow-200 mb-3">
                    <label className="block text-xs font-bold mb-1 text-gray-700">Быстрое решение (введите адрес контейнера):</label>
                    <input 
                        type="text" 
                        placeholder="https://d5...yandexcloud.net" 
                        value={manualUrl}
                        onChange={e => setManualUrl(e.target.value)}
                        className="w-full p-2 text-sm border border-gray-300 rounded mb-2"
                    />
                    <button 
                        onClick={saveManualUrl}
                        className="w-full py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 font-bold"
                    >
                        Сохранить и подключиться
                    </button>
                    <p className="text-[10px] text-gray-500 mt-1">Ссылку можно найти в Yandex Cloud Console &rarr; Serverless Containers.</p>
                </div>
             </div>
        )}
        
        {typeof localStorage !== 'undefined' && localStorage.getItem('teacher_crm_api_url') && (
             <div className="mb-4 text-center">
                 <button onClick={resetManualUrl} className="text-xs text-red-500 hover:underline">
                     Сбросить ручную настройку сервера
                 </button>
             </div>
        )}
        
        <p className="text-gray-600 mb-6 text-center text-lg">
            {isSignUp ? 'Регистрация' : 'Вход в систему'}
        </p>
        
        {message && (
            <div className={`mb-4 p-3 rounded text-sm whitespace-pre-wrap ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {message.text}
            </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
                <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                    required
                    minLength={6}
                />
            </div>
            <button 
                type="submit" 
                disabled={loading}
                className="w-full py-2 px-4 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition disabled:bg-indigo-300"
            >
                {loading ? 'Загрузка...' : (isSignUp ? 'Зарегистрироваться' : 'Войти')}
            </button>
            
             <div className="mt-4 flex flex-col items-center space-y-2">
                <button 
                    type="button"
                    onClick={() => { setIsSignUp(!isSignUp); setMessage(null); }}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                    {isSignUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}
