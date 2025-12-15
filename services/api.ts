
/* eslint-disable @typescript-eslint/no-explicit-any */
// Укажите здесь URL вашего контейнера из Yandex Cloud
// Например: https://d5dk...yandex.net
const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

console.log('CRM API URL:', API_URL); // Для отладки в консоли браузера

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
            try {
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
            } catch (e) {
                console.error("Auth Error:", e);
                return { error: new Error("Нет связи с сервером. Проверьте консоль.") };
            }
        },
        async signInWithPassword(data: any) {
            try {
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
                localStorage.setItem('teacher_crm_session', JSON.stringify(responseData.session));
                return { data: responseData, error: null };
            } catch (e) {
                console.error("Auth Error:", e);
                return { error: new Error("Нет связи с сервером. Проверьте консоль.") };
            }
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
                const payload = Array.isArray(data) ? data[0] : data; 
                const res = await fetch(`${API_URL}/${table}`, {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify(payload)
                });
                const responseData = await res.json();
                return { data: Array.isArray(data) ? [responseData] : responseData, error: res.ok ? null : new Error(responseData.error) };
            },
            update: (updates: any) => ({
                eq: async (_col: string, val: string) => {
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
                eq: async (_col: string, val: string) => {
                    const res = await fetch(`${API_URL}/${table}?id=${val}`, { method: 'DELETE', headers: getHeaders() });
                    return { error: res.ok ? null : new Error('Delete failed') };
                },
                in: async (_col: string, vals: string[]) => {
                    const res = await fetch(`${API_URL}/${table}?ids=${vals.join(',')}`, { method: 'DELETE', headers: getHeaders() });
                    return { error: res.ok ? null : new Error('Delete failed') };
                },
                match: async (query: any) => {
                    const params = new URLSearchParams(query);
                    const res = await fetch(`${API_URL}/${table}?${params.toString()}`, { method: 'DELETE', headers: getHeaders() });
                    return { error: res.ok ? null : new Error('Delete failed') };
                }
            }),
            upsert: async (data: any, _config?: any) => {
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
