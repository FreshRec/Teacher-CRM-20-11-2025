import React, { useState } from 'react';
import { api } from '../services/api';

// Получаем URL для отображения (чтобы вы видели, куда идет запрос)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

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

  // Проверка: сайт не локальный, а API указывает на localhost
  const isProductionButUsingLocalhost = typeof window !== 'undefined' && 
      window.location.hostname !== 'localhost' && 
      window.location.hostname !== '127.0.0.1' && 
      API_URL.includes('localhost');

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
        
        setMessage({ text: errorMessage, type: 'error' });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-indigo-600 mb-2 text-center">Teacher's CRM</h1>
        
        <div className="text-xs text-center text-gray-500 mb-6 font-mono bg-gray-50 p-2 rounded break-all border border-gray-200">
            Сервер API: {API_URL}
        </div>

        {isProductionButUsingLocalhost && (
             <div className="mb-6 p-4 rounded text-sm bg-yellow-50 text-yellow-900 border border-yellow-200 shadow-sm">
                <h3 className="font-bold mb-2 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    Требуется настройка
                </h3>
                <p className="mb-2">
                    Сайт открыт в интернете, но пытается подключиться к <code>localhost</code>.
                </p>
                <div className="bg-white p-2 rounded border border-yellow-100 mb-2">
                    <strong>Что делать (на GitHub):</strong>
                    <ol className="list-decimal list-inside ml-1 mt-1 space-y-1 text-xs">
                        <li>Откройте этот репозиторий на GitHub</li>
                        <li>Перейдите: <b>Settings</b> &rarr; <b>Secrets and variables</b> &rarr; <b>Actions</b></li>
                        <li>Нажмите <b>New repository secret</b></li>
                        <li>Name: <code>VITE_API_URL</code></li>
                        <li>Value: Ссылка на ваш контейнер (<code>https://d5...</code>)</li>
                        <li>Сделайте <code>git push</code> или перезапустите Action</li>
                    </ol>
                </div>
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
