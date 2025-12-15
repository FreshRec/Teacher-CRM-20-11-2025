/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { api } from './services/api';
import { 
    Student, Group, SubscriptionPlan, Attendance, FinancialTransaction, StudentSubscription, ScheduleEvent, ScheduleEventException,
    Expense,
    StudentForCreation, GroupForCreation, SubscriptionPlanForCreation, StudentSubscriptionForCreation, 
    FinancialTransactionForCreation, AttendanceForCreation, ScheduleEventForCreation,
    ExpenseForCreation,
    IAppContext,
    DisplayEvent,
    UserProfile
} from './types';
import { notificationService } from './services/notificationService';

const AppContext = createContext<IAppContext | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);

    const [students, setStudents] = useState<Student[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
    const [studentSubscriptions, setStudentSubscriptions] = useState<StudentSubscription[]>([]);
    const [attendance, setAttendance] = useState<Attendance[]>([]);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [scheduleEvents, setScheduleEvents] = useState<ScheduleEvent[]>([]);
    const [eventExceptions, setEventExceptions] = useState<ScheduleEventException[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    
    const [notifications, setNotifications] = useState<{ id: number; message: string; type: 'success' | 'error' }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const getOccurrenceKey = useCallback((date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }, []);

    const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    }, []);

    const fetchUserProfile = useCallback(async () => {
        const { data: { session } } = await api.auth.getSession();
        if (!session?.user) return;

        try {
            // Используем api.ts для запроса профиля
            const { data: profileData, error } = await api.from('profiles').select({ id: session.user.id });
            
            if (error) throw error;

            if (profileData) {
                // api.ts select может вернуть объект (если был query) или массив
                // В нашем случае backend при запросе с ?id=... возвращает объект
                const profile = profileData as UserProfile;
                setUserProfile(profile);
                
                if (profile.role === 'admin') {
                    const { data: all } = await api.from('profiles').select();
                    if (Array.isArray(all)) {
                        setAllProfiles(all as UserProfile[]);
                    }
                }
            }
        } catch (e: any) {
            console.error("Failed to fetch user profile", e);
            // Не показываем уведомление об ошибке профиля, чтобы не спамить при первом входе, 
            // так как профиль может создаваться асинхронно
        }
    }, []);

    const updateUserProfile = useCallback(async (id: string, updates: Partial<UserProfile>) => {
        setIsSaving(true);
        const { error } = await api.from('profiles').update(updates).eq('id', id);
        if (error) {
            showNotification(`Ошибка обновления профиля: ${error.message}`, 'error');
        } else {
            showNotification('Профиль обновлен', 'success');
            await fetchUserProfile();
        }
        setIsSaving(false);
    }, [fetchUserProfile, showNotification]);

    const fetchData = useCallback(async (isInitialLoad = true) => {
        if (isInitialLoad) setIsLoading(true);
        try {
            await fetchUserProfile();

            const results = await Promise.all([
                api.from('students').select(),
                api.from('groups').select(),
                api.from('subscription_plans').select(),
                api.from('student_subscriptions').select(),
                api.from('attendance').select(),
                api.from('financial_transactions').select(),
                api.from('schedule_events').select(),
                api.from('schedule_event_exceptions').select(),
                api.from('expenses').select(),
            ]);
    
            const errors = results.map((res) => res.error).filter(Boolean);
            if (errors.length > 0) throw new Error(errors.map(e => e!.message).join('\n'));
    
            const [
                { data: studentsRaw }, { data: groupsRaw }, { data: plansRaw },
                { data: studentSubsRaw }, { data: attendanceRaw }, { data: transactionsRaw },
                { data: eventsRaw }, { data: exceptionsRaw }, { data: expensesRaw },
            ] = results;

            const sanitize = (data: unknown): any[] => Array.isArray(data) ? data : [];

            const sanitizedGroups = sanitize(groupsRaw).filter((g: any) => g && g.id && g.name).map((g: any) => ({...g}));
            
            const sanitizedPlans = sanitize(plansRaw).filter((p: any) => p && p.id).map((p: any) => ({
                ...p,
                name: p.name || 'Без имени',
                price: typeof p.price === 'number' ? Number(p.price) : 0, 
                discount: typeof p.discount === 'number' ? Number(p.discount) : 0,
                lesson_count: typeof p.lesson_count === 'number' ? p.lesson_count : 0,
            }));

            const sanitizedStudentSubs = sanitize(studentSubsRaw)
                .map((s: any) => ({
                    ...s,
                    price_paid: Number(s.price_paid),
                    lessons_attended: typeof s.lessons_attended === 'number' ? s.lessons_attended : 0,
                    assigned_group_id: s.assigned_group_id || null,
                }));

            const sanitizedAttendance = sanitize(attendanceRaw).filter((a: any) => a && a.student_id && a.date && a.status).map((a: any) => ({...a}));
            
            const sanitizedTransactions = sanitize(transactionsRaw)
                .map((t: any) => ({
                    ...t,
                    amount: Number(t.amount),
                    description: t.description || '',
                }));
            
            const sanitizedEvents = sanitize(eventsRaw)
                .filter((e: any) => e && e.id && e.start && e.end && e.title)
                .map((e: any) => ({
                    ...e,
                    is_recurring: !!e.is_recurring,
                }));

            const sanitizedExceptions = sanitize(exceptionsRaw).filter((e: any) => e && e.original_event_id && e.original_start_time).map((e: any) => ({...e}));

            const sanitizedExpenses = sanitize(expensesRaw)
                .map((e: any) => ({
                    ...e,
                    amount: Number(e.amount),
                    description: e.description || 'Без описания',
                }));

            const sanitizedStudents = sanitize(studentsRaw).filter((s: any) => s && s.id).map((s: any) => ({
                ...s,
                name: s.name || 'Имя не указано',
                balance: typeof s.balance === 'number' || typeof s.balance === 'string' ? Number(s.balance) : 0,
                group_ids: Array.isArray(s.group_ids) ? s.group_ids : [],
                status: s.status || 'active',
                parent_name: s.parent_name || 'Не указано',
                parent_phone1: s.parent_phone1 || 'Не указано',
                birth_date: s.birth_date || null,
            }));
            
            setGroups(sanitizedGroups);
            setSubscriptionPlans(sanitizedPlans);
            setStudentSubscriptions(sanitizedStudentSubs);
            setAttendance(sanitizedAttendance);
            setTransactions(sanitizedTransactions);
            setScheduleEvents(sanitizedEvents);
            setEventExceptions(sanitizedExceptions);
            setExpenses(sanitizedExpenses);
    
            const enrichedStudents = sanitizedStudents.map((s: any) => ({
                ...s,
                subscriptions: sanitizedStudentSubs.filter((sub: any) => sub.student_id === s.id),
                transactions: sanitizedTransactions.filter((tx: any) => tx.student_id === s.id),
            }));
    
            setStudents(enrichedStudents);
    
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            showNotification(`Ошибка загрузки данных: ${msg}`, 'error');
        } finally {
             if (isInitialLoad) setIsLoading(false);
        }
    }, [fetchUserProfile, showNotification]);

    const seedDatabase = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Создаем группы (по одной, так как API может не поддерживать массив)
            const g1Res = await api.from('groups').insert({ name: 'Kids A1' });
            const g2Res = await api.from('groups').insert({ name: 'Teens B1' });
            
            const g1Data = Array.isArray(g1Res.data) ? g1Res.data[0] : g1Res.data;
            const g2Data = Array.isArray(g2Res.data) ? g2Res.data[0] : g2Res.data;

            if (!g1Data?.id || !g2Data?.id) throw new Error('Failed to create groups');
            const g1Id = g1Data.id;
            const g2Id = g2Data.id;

            // 2. Генерируем учеников
            const firstNames = ['Александр', 'Мария', 'Дмитрий', 'Елена', 'Иван', 'София', 'Максим', 'Анна', 'Артем', 'Виктория'];
            const lastNames = ['Иванов(а)', 'Петров(а)', 'Сидоров(а)', 'Смирнов(а)', 'Волков(а)', 'Кузнецов(а)', 'Соколов(а)'];
            
            // Вставляем учеников по одному
            for(let i=0; i<15; i++) {
                const name = `${firstNames[Math.floor(Math.random()*firstNames.length)]} ${lastNames[Math.floor(Math.random()*lastNames.length)]}`;
                await api.from('students').insert({
                    name,
                    parent_name: 'Родитель ' + name.split(' ')[0],
                    parent_phone1: '+79' + Math.floor(100000000 + Math.random() * 900000000),
                    balance: 0,
                    status: 'active',
                    group_ids: [Math.random() > 0.5 ? g1Id : g2Id]
                });
            }
            
            // 3. Создаем абонементы
            await api.from('subscription_plans').insert({ name: '8 занятий', price: 6000, discount: 0, lesson_count: 8 });
            await api.from('subscription_plans').insert({ name: '12 занятий', price: 8000, discount: 500, lesson_count: 12 });

            showNotification('Демо-данные успешно созданы!', 'success');
            await fetchData(false);
        } catch (e: any) {
            console.error(e);
            showNotification(`Ошибка при создании данных: ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showNotification, fetchData]);

    const allVisibleEvents = useMemo(() => {
        const allEvents: DisplayEvent[] = [];
        const exceptionsMap: Map<string, ScheduleEventException> = new Map(eventExceptions.map(ex => [`${ex.original_event_id}-${ex.original_start_time}`, ex]));
    
        scheduleEvents.forEach(event => {
            if (!event) return; 
            if (!event.start || !event.end) return;
            
            const startDate = new Date(event.start);
            const endDate = new Date(event.end);
            
            allEvents.push({ 
                ...event, 
                originalId: event.id, 
                isVirtual: false,
                occurrence_key: getOccurrenceKey(startDate)
            });
    
            if (event.is_recurring) {
                const duration = endDate.getTime() - startDate.getTime();
                const nextDate = new Date(startDate);
    
                for (let i = 1; i <= 52; i++) { 
                    nextDate.setDate(nextDate.getDate() + 7);
                    
                    const occurrenceStartDate = new Date(nextDate);
                    const occurrenceKey = getOccurrenceKey(occurrenceStartDate);
                    const exception = exceptionsMap.get(`${event.id}-${occurrenceKey}`);
    
                    if (exception?.is_deleted) continue;
                    
                    const finalStartStr = exception?.new_start_time || occurrenceStartDate.toISOString();
                    const finalStartDate = new Date(finalStartStr);
                    const finalEndDate = exception?.new_end_time 
                        ? new Date(exception.new_end_time) 
                        : new Date(finalStartDate.getTime() + duration);
                    
                    allEvents.push({
                        ...event,
                        id: `${event.id}-recur-${i}`,
                        originalId: event.id,
                        start: finalStartDate.toISOString(),
                        end: finalEndDate.toISOString(),
                        title: exception?.new_title || event.title,
                        group_id: exception?.new_group_id !== undefined ? exception.new_group_id : event.group_id,
                        isVirtual: true,
                        exception: exception,
                        occurrence_key: occurrenceKey,
                    });
                }
            }
        });
        return allEvents;
    }, [scheduleEvents, eventExceptions, getOccurrenceKey]);

    useEffect(() => {
        fetchData(true);
    }, [fetchData]);

    const addStudent = async (student: StudentForCreation): Promise<Student | null> => {
        setIsSaving(true);
        const { data, error } = await api.from('students').insert(student);
        if (error) {
            showNotification(`Ошибка добавления ученика: ${error.message}`, 'error');
            setIsSaving(false);
            return null;
        }
        if (data) {
            notificationService.sendWelcomeEmail(data as Student);
            await fetchData(false);
            setIsSaving(false);
            return data as Student;
        }
        setIsSaving(false);
        return null;
    };
    
    const addStudents = async (students: StudentForCreation[]): Promise<Student[] | null> => {
        setIsSaving(true);
        const results = [];
        for (const s of students) {
             const { data } = await api.from('students').insert(s);
             if (data) results.push(data);
        }
        await fetchData(false);
        setIsSaving(false);
        return results as Student[];
    };

    const updateStudent = async (id: string, updates: Partial<Student>): Promise<Student | null> => {
        setIsSaving(true);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { subscriptions, transactions, ...updatePayload } = updates;
        const { data, error } = await api.from('students').update(updatePayload).eq('id', id);
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data as Student;
    };

    const deleteStudents = async (ids: string[]): Promise<boolean> => {
        setIsSaving(true);
        const { error } = await api.from('students').delete().in('id', ids);
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return false; }
        await fetchData(false);
        setIsSaving(false);
        return true;
    };
    
    const addGroup = async (group: GroupForCreation): Promise<Group | null> => {
        setIsSaving(true);
        const { data, error } = await api.from('groups').insert(group);
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };
    
    const updateGroup = async (id: string, updates: Partial<Group>): Promise<Group | null> => {
        setIsSaving(true);
        const { data, error } = await api.from('groups').update(updates).eq('id', id);
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };
    
    const deleteGroup = async (id: string): Promise<boolean> => {
        setIsSaving(true);
        const { error } = await api.from('groups').delete().eq('id', id);
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return false; }
        await fetchData(false);
        setIsSaving(false);
        return true;
    };
    
    const addSubscriptionPlan = async (plan: SubscriptionPlanForCreation): Promise<SubscriptionPlan | null> => {
        setIsSaving(true);
        const { data, error } = await api.from('subscription_plans').insert(plan);
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };

    const updateSubscriptionPlan = async (id: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | null> => {
        setIsSaving(true);
        if (updates.is_default) {
            // Logic for default plan
        }
        const { data, error } = await api.from('subscription_plans').update(updates).eq('id', id);
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };
    
    const deleteSubscriptionPlan = async (id: string): Promise<boolean> => {
        setIsSaving(true);
        const { error } = await api.from('subscription_plans').delete().eq('id', id);
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return false; }
        await fetchData(false);
        setIsSaving(false);
        return true;
    };

    const addTransaction = async (transaction: FinancialTransactionForCreation): Promise<FinancialTransaction | null> => {
        const { data: txData, error: txError } = await api.from('financial_transactions').insert(transaction);
        if (txError) { showNotification(`Ошибка транзакции: ${txError.message}`, 'error'); return null; }
        
        const student = students.find(s => s.id === transaction.student_id);
        if (student) {
            let newBalance = student.balance;
            if (transaction.type === 'refund' || transaction.type === 'correction') {
                newBalance += transaction.amount;
            } else if (transaction.type === 'debit') {
                newBalance -= transaction.amount;
            }
            if (newBalance !== student.balance) {
                await api.from('students').update({ balance: newBalance }).eq('id', student.id);
            }
        }
        return txData;
    };
    
    const addStudentSubscription = async (sub: StudentSubscriptionForCreation): Promise<StudentSubscription | null> => {
        setIsSaving(true);
        try {
            const { data: newSubData, error } = await api.from('student_subscriptions').insert(sub);
            if (error || !newSubData) throw error || new Error("Failed to create subscription");

            const plan = subscriptionPlans.find(p => p.id === sub.subscription_plan_id);
            await addTransaction({
                student_id: sub.student_id,
                type: 'payment',
                amount: sub.price_paid,
                description: `Оплата абонемента: ${plan?.name || ''}`,
                student_subscription_id: newSubData.id,
            });
            
            showNotification('Абонемент успешно добавлен.', 'success');
            await fetchData(false);
            return newSubData;
        } catch(error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            showNotification(msg, 'error');
            return null;
        } finally {
            setIsSaving(false);
        }
    };
    
    const updateStudentSubscription = async (id: string, updates: Partial<StudentSubscription>): Promise<StudentSubscription | null> => {
        setIsSaving(true);
        const { data, error } = await api.from('student_subscriptions').update(updates).eq('id', id);
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };

    const refundToBalanceAndCancelSubscription = async (subscriptionId: string): Promise<void> => {
        const sub = studentSubscriptions.find(s => s.id === subscriptionId);
        if (!sub) return;
        
        await api.from('student_subscriptions').delete().eq('id', sub.id);
        await fetchData(false);
    };

    const processCashRefundAndCancelSubscription = async (subscriptionId: string): Promise<void> => {
         const sub = studentSubscriptions.find(s => s.id === subscriptionId);
         if (!sub) return;
         await api.from('student_subscriptions').delete().eq('id', sub.id);
         await fetchData(false);
    };
    
    const setAttendanceRecord = async (record: AttendanceForCreation): Promise<void> => {
        setIsSaving(true);
        const { error } = await api.from('attendance').upsert({ ...record, grade: record.grade === undefined ? null : record.grade });
        if (error) showNotification(`Ошибка: ${error.message}`, 'error');
        await fetchData(false);
        setIsSaving(false);
    };

    const deleteAttendanceRecord = async (studentId: string, date: string): Promise<void> => {
        setIsSaving(true);
        const { error } = await api.from('attendance').delete().match({ student_id: studentId, date });
        if (error) showNotification(`Ошибка: ${error.message}`, 'error');
        await fetchData(false);
        setIsSaving(false);
    };
    
    const addScheduleEvent = async (event: ScheduleEventForCreation): Promise<ScheduleEvent | null> => {
        setIsSaving(true);
        const { data, error } = await api.from('schedule_events').insert(event);
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };
    
    const updateScheduleEvent = async (id: string, updates: Partial<ScheduleEvent>): Promise<ScheduleEvent | null> => {
        setIsSaving(true);
        const { data, error } = await api.from('schedule_events').update(updates).eq('id', id);
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };
    
    const deleteScheduleEvent = async (id: string): Promise<boolean> => {
        setIsSaving(true);
        const { error } = await api.from('schedule_events').delete().eq('id', id);
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return false; }
        await fetchData(false);
        setIsSaving(false);
        return true;
    };
    
    const addEventException = async (exception: ScheduleEventException): Promise<ScheduleEventException | null> => {
        setIsSaving(true);
        const { data, error } = await api.from('schedule_event_exceptions').upsert(exception);
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };

    const addExpense = async (expense: ExpenseForCreation): Promise<Expense | null> => {
        setIsSaving(true);
        const expenseToInsert = { ...expense, date: expense.date || new Date().toISOString() };
        const { data, error } = await api.from('expenses').insert(expenseToInsert);
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };

    const updateExpense = async (id: string, updates: Partial<Omit<Expense, 'id'>>): Promise<Expense | null> => {
        setIsSaving(true);
        const { data, error } = await api.from('expenses').update(updates).eq('id', id);
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };

    const deleteExpense = async (id: string): Promise<boolean> => {
        setIsSaving(true);
        const { error } = await api.from('expenses').delete().eq('id', id);
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return false; }
        await fetchData(false);
        setIsSaving(false);
        return true;
    };
    
    const clearStudentFinancialData = async (): Promise<void> => {
       showNotification('Очистка через API не реализована в демо-режиме', 'error');
    };

    const value: IAppContext = {
        userProfile, allProfiles,
        students, groups, subscriptionPlans, attendance, transactions, scheduleEvents, eventExceptions, allVisibleEvents, expenses,
        notifications, isLoading, isSaving, showNotification, addStudent, addStudents, updateStudent, deleteStudents,
        addGroup, updateGroup, deleteGroup, addSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan,
        addStudentSubscription, updateStudentSubscription, refundToBalanceAndCancelSubscription, processCashRefundAndCancelSubscription,
        addTransaction, setAttendanceRecord, deleteAttendanceRecord, addScheduleEvent, updateScheduleEvent,
        deleteScheduleEvent, addEventException, addExpense, updateExpense, deleteExpense, clearStudentFinancialData,
        updateUserProfile, seedDatabase
    };

    return (
        <AppContext.Provider value={value}>
            {children}
            <div className="fixed top-4 right-4 z-50 space-y-2">
                {notifications.map(n => (
                    <div key={n.id} className={`px-4 py-2 rounded-md shadow-lg text-white ${n.type === 'success' ? 'bg-green-500' : 'bg-red-500'} whitespace-pre-wrap`}>
                        {n.message}
                    </div>
                ))}
            </div>
        </AppContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAppContext = (): IAppContext => {
    const context = useContext(AppContext);
    if (context === null) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
