import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

export function UpdatePassword({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage({ text: 'Пароль успешно обновлен!', type: 'success' });
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error) {
      const errorMessage = (error as Error).message || 'Ошибка при обновлении пароля';
      setMessage({ text: errorMessage, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-indigo-600 mb-6 text-center">Новый пароль</h1>
        
        {message && (
          <div className={`mb-4 p-3 rounded text-sm ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Введите новый пароль</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
              required
              minLength={6}
              placeholder="Минимум 6 символов"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-2 px-4 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition disabled:bg-indigo-300"
          >
            {loading ? 'Сохранение...' : 'Сохранить пароль'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
        if (isSignUp) {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });
            if (error) throw error;
            setMessage({ text: 'Проверьте почту для подтверждения регистрации!', type: 'success' });
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
        }
    } catch (error) {
        const errorMessage = (error as Error).message || 'Ошибка авторизации';
        setMessage({ text: errorMessage, type: 'error' });
    } finally {
        setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setMessage(null);
      try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin,
          });
          if (error) throw error;
          setMessage({ text: 'Ссылка для сброса пароля отправлена на ваш Email', type: 'success' });
      } catch (error) {
           const errorMessage = (error as Error).message || 'Ошибка при сбросе пароля';
           setMessage({ text: errorMessage, type: 'error' });
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-indigo-600 mb-6 text-center">Teacher's CRM</h1>
        
        <p className="text-gray-600 mb-6 text-center text-lg">
            {isForgotPassword 
                ? 'Восстановление пароля' 
                : (isSignUp ? 'Регистрация' : 'Вход в систему')}
        </p>
        
        {message && (
            <div className={`mb-4 p-3 rounded text-sm ${message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {message.text}
            </div>
        )}

        {isForgotPassword ? (
             <form onSubmit={handleResetPassword} className="space-y-4">
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
                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-2 px-4 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition disabled:bg-indigo-300"
                >
                    {loading ? 'Отправка...' : 'Отправить ссылку'}
                </button>
                <div className="text-center mt-4">
                    <button 
                        type="button"
                        onClick={() => { setIsForgotPassword(false); setMessage(null); }}
                        className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                        Вернуться ко входу
                    </button>
                </div>
             </form>
        ) : (
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
                {!isSignUp && (
                    <button 
                        type="button"
                        onClick={() => { setIsForgotPassword(true); setMessage(null); }}
                        className="text-sm text-gray-600 hover:text-gray-800"
                    >
                        Забыли пароль?
                    </button>
                )}
                <button 
                    type="button"
                    onClick={() => { setIsSignUp(!isSignUp); setMessage(null); }}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                    {isSignUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
                </button>
            </div>
            </form>
        )}
      </div>
    </div>
  );
}
