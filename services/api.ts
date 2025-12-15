/* eslint-disable @typescript-eslint/no-explicit-any */
// Реальный API клиент для взаимодействия с backend/server.js

// Получаем URL из переменной окружения или используем localhost по умолчанию
const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

// Логируем адрес API для отладки (видно в консоли браузера)
console.log('API Client initialized. Target URL:', API_URL);

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
            } catch (e: any) {
                console.error('Auth Error:', e);
                // Прокидываем ошибку fetch (Network Error) как есть
                return { error: e };
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
            } catch (e: any) {
                console.error('Auth Error:', e);
                return { error: e };
            }
        },
        async signOut() {
            localStorage.removeItem('teacher_crm_session');
            window.location.reload();
        },
        async getSession() {
            const sessionStr = localStorage.getItem('teacher_crm_session');
            if (!sessionStr) return { data: { session: null } };
            try {
                return { data: { session: JSON.parse(sessionStr) } };
            } catch (e) {
                localStorage.removeItem('teacher_crm_session');
                return { data: { session: null } };
            }
        }
    },
    from(table: string) {
        return {
            select: async (queryParams?: Record<string, string>) => {
                try {
                    let url = `${API_URL}/${table}`;
                    if (queryParams) {
                        const params = new URLSearchParams(queryParams);
                        url += `?${params.toString()}`;
                    }
                    
                    const res = await fetch(url, { headers: getHeaders() });
                    if (!res.ok) throw new Error(`Fetch error ${res.status}: ${res.statusText}`);
                    const data = await res.json();
                    return { data, error: null };
                } catch (e: any) {
                    console.error(`Select Error (${table}):`, e);
                    return { data: null, error: e };
                }
            },
            insert: async (data: any) => {
                try {
                    const payload = Array.isArray(data) ? data[0] : data; 
                    const res = await fetch(`${API_URL}/${table}`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify(payload)
                    });
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({ error: res.statusText }));
                        throw new Error(err.error || 'Insert failed');
                    }
                    const responseData = await res.json();
                    return { data: Array.isArray(data) ? [responseData] : responseData, error: null };
                } catch (e: any) {
                    console.error(`Insert Error (${table}):`, e);
                    return { data: null, error: e };
                }
            },
            update: (updates: any) => ({
                eq: async (_col: string, val: string) => {
                    try {
                        const res = await fetch(`${API_URL}/${table}/${val}`, {
                            method: 'PATCH',
                            headers: getHeaders(),
                            body: JSON.stringify(updates)
                        });
                        if (!res.ok) throw new Error('Update failed');
                        const data = await res.json();
                        return { data, error: null };
                    } catch (e: any) {
                         console.error(`Update Error (${table}):`, e);
                        return { data: null, error: e };
                    }
                }
            }),
            delete: () => ({
                eq: async (_col: string, val: string) => {
                    try {
                        const res = await fetch(`${API_URL}/${table}?id=${val}`, { method: 'DELETE', headers: getHeaders() });
                        if (!res.ok) throw new Error('Delete failed');
                        return { error: null };
                    } catch (e: any) { return { error: e }; }
                },
                in: async (_col: string, vals: string[]) => {
                    try {
                        const res = await fetch(`${API_URL}/${table}?ids=${vals.join(',')}`, { method: 'DELETE', headers: getHeaders() });
                        if (!res.ok) throw new Error('Delete failed');
                        return { error: null };
                    } catch (e: any) { return { error: e }; }
                },
                match: async (query: any) => {
                    try {
                        const params = new URLSearchParams(query);
                        const res = await fetch(`${API_URL}/${table}?${params.toString()}`, { method: 'DELETE', headers: getHeaders() });
                        if (!res.ok) throw new Error('Delete failed');
                        return { error: null };
                    } catch (e: any) { return { error: e }; }
                }
            }),
            upsert: async (data: any) => {
                try {
                    const payload = Array.isArray(data) ? data[0] : data; 
                    const res = await fetch(`${API_URL}/${table}`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify(payload)
                    });
                    if (!res.ok) throw new Error('Upsert failed');
                    const responseData = await res.json();
                    return { data: responseData, error: null };
                } catch (e: any) {
                    return { data: null, error: e };
                }
            }
        };
    }
};
