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
        <div className="text-xs text-center text-gray-400 mb-6 font-mono bg-gray-50 p-1 rounded">
            Server: {API_URL}
        </div>
        
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
