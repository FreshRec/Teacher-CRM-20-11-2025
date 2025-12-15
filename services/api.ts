// Укажите здесь URL вашего контейнера из Yandex Cloud
// Например: https://d5dk...yandex.net
const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

const getHeaders = () => {
    const session = localStorage.getItem('teacher_crm_session');
    const token = session ? JSON.parse(session).access_token : '';
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const api = {
    auth: {
        async signUp(data: any) {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                 const err = await res.json();
                 return { error: new Error(err.error || 'Registration failed') };
            }
            const session = await res.json();
            return { data: session, error: null };
        },
        async signInWithPassword(data: any) {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                 const err = await res.json();
                 return { error: new Error(err.error || 'Login failed') };
            }
            const responseData = await res.json();
            // Сохраняем сессию как Supabase, чтобы меньше ломать логику App.tsx, но лучше свое
            localStorage.setItem('teacher_crm_session', JSON.stringify(responseData.session));
            return { data: responseData, error: null };
        },
        async signOut() {
            localStorage.removeItem('teacher_crm_session');
            window.location.reload();
        },
        async getSession() {
            const sessionStr = localStorage.getItem('teacher_crm_session');
            if (!sessionStr) return { data: { session: null } };
            return { data: { session: JSON.parse(sessionStr) } };
        }
    },
    from(table: string) {
        return {
            select: async () => {
                const res = await fetch(`${API_URL}/${table}`, { headers: getHeaders() });
                const data = await res.json();
                return { data, error: res.ok ? null : new Error('Fetch failed') };
            },
            insert: async (data: any) => {
                // Если массив, отправляем по одному (упрощение, т.к. бэкенд в примере принимает объект)
                // Или допилить бэкенд на прием массива.
                // Для совместимости с текущим кодом (который иногда шлет массив)
                const payload = Array.isArray(data) ? data[0] : data; 
                const res = await fetch(`${API_URL}/${table}`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(payload)
                });
                const responseData = await res.json();
                // Если был массив, вернем массив
                return { data: Array.isArray(data) ? [responseData] : responseData, error: res.ok ? null : new Error(responseData.error) };
            },
            update: (updates: any) => ({
                eq: async (col: string, val: string) => {
                    const res = await fetch(`${API_URL}/${table}/${val}`, {
                        method: 'PATCH',
                        headers: getHeaders(),
                        body: JSON.stringify(updates)
                    });
                    const data = await res.json();
                    return { data, error: res.ok ? null : new Error(data.error) };
                }
            }),
            delete: () => ({
                eq: async (col: string, val: string) => {
                     // Удаление по ID
                    const res = await fetch(`${API_URL}/${table}?id=${val}`, { method: 'DELETE', headers: getHeaders() });
                    return { error: res.ok ? null : new Error('Delete failed') };
                },
                in: async (col: string, vals: string[]) => {
                     // Массовое удаление
                    const res = await fetch(`${API_URL}/${table}?ids=${vals.join(',')}`, { method: 'DELETE', headers: getHeaders() });
                    return { error: res.ok ? null : new Error('Delete failed') };
                },
                match: async (query: any) => {
                     // Специфично для attendance delete
                    const params = new URLSearchParams(query);
                    const res = await fetch(`${API_URL}/${table}?${params.toString()}`, { method: 'DELETE', headers: getHeaders() });
                    return { error: res.ok ? null : new Error('Delete failed') };
                }
            }),
            upsert: async (data: any, config?: any) => {
                 // Реализуем как POST для упрощения, сервер должен обрабатывать ON CONFLICT
                 // В server.js это реализовано для attendance и exceptions
                const payload = Array.isArray(data) ? data[0] : data; 
                const res = await fetch(`${API_URL}/${table}`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(payload)
                });
                const responseData = await res.json();
                return { data: responseData, error: res.ok ? null : new Error(responseData.error) };
            }
        };
    }
};
