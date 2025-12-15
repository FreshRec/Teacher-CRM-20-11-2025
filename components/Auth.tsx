import React, { useState } from 'react';
import { api } from '../services/api';

export function UpdatePassword({ onSuccess }: { onSuccess: () => void }) {
  // В демо-версии смены пароля нет в API, просто заглушка
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
             // Успешный вход перегрузит страницу или обновит состояние в App.tsx через слушатель
             window.location.reload();
        }
    } catch (error) {
        const errorMessage = (error as Error).message || 'Ошибка авторизации';
        setMessage({ text: errorMessage, type: 'error' });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-indigo-600 mb-6 text-center">Teacher's CRM (YC Edition)</h1>
        
        <p className="text-gray-600 mb-6 text-center text-lg">
            {isSignUp ? 'Регистрация' : 'Вход в систему'}
        </p>
        
        {message && (
            <div className={`mb-4 p-3 rounded text-sm ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
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
