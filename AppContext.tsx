
/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from './services/supabaseClient';
import { 
    Student, Group, SubscriptionPlan, Attendance, FinancialTransaction, StudentSubscription, ScheduleEvent, ScheduleEventException,
    Expense,
    StudentForCreation, GroupForCreation, SubscriptionPlanForCreation, StudentSubscriptionForCreation, 
    FinancialTransactionForCreation, AttendanceForCreation, ScheduleEventForCreation,
    ExpenseForCreation,
    IAppContext,
    DisplayEvent,
    UserProfile,
    UserPermissions
} from './types';
import { notificationService } from './services/notificationService';
import { SYSTEM_SUBSCRIPTION_PLAN_ID } from './constants';

const AppContext = createContext<IAppContext | null>(null);

const getOccurrenceKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const defaultPermissions: UserPermissions = {
    canViewDashboard: true,
    canViewStudents: true,
    canViewJournal: true,
    canViewGroups: true,
    canViewSubscriptions: true,
    canViewSchedule: true,
    canViewFinance: false,
    canViewArchive: false,
    canManageUsers: false,
};

const adminPermissions: UserPermissions = {
    canViewDashboard: true,
    canViewStudents: true,
    canViewJournal: true,
    canViewGroups: true,
    canViewSubscriptions: true,
    canViewSchedule: true,
    canViewFinance: true,
    canViewArchive: true,
    canManageUsers: true,
};

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

    const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    }, []);

    const seedDatabase = useCallback(async () => {
        showNotification('База данных пуста. Создаю тестовые данные...');
        const groupsToCreate = [
            { name: 'Beginners A' },
            { name: 'Elementary B' },
            { name: 'Pre-Intermediate' },
            { name: 'Upper-Intermediate C' }
        ];
        const { data: insertedGroups, error: groupsError } = await supabase.from('groups').insert(groupsToCreate).select();

        if (groupsError || !insertedGroups) {
            showNotification('Ошибка создания групп.', 'error');
            return;
        }

        const firstNames = ['Иван', 'Петр', 'Сергей', 'Анна', 'Мария', 'Елена', 'Дмитрий', 'Алексей', 'Ольга', 'Светлана'];
        const lastNames = ['Иванов', 'Петров', 'Сергеев', 'Смирнов', 'Кузнецов', 'Попов', 'Васильев', 'Соколов', 'Михайлов', 'Новиков'];
        
        const studentsToCreate: StudentForCreation[] = [];
        for (let i = 0; i < 100; i++) {
            const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
            const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
            const isMale = ['Иван', 'Петр', 'Сергей', 'Дмитрий', 'Алексей'].includes(firstName);
            
            studentsToCreate.push({
                name: `${lastName} ${firstName}`,
                parent_name: `${lastName} ${isMale ? 'Отец' : 'Мать'}`,
                parent_phone1: `+7(999)${Math.floor(100 + Math.random() * 900)}-${Math.floor(10 + Math.random() * 90)}-${Math.floor(10 + Math.random() * 90)}`,
                birth_date: new Date(2010 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
                balance: 0,
                status: 'active',
                group_ids: [insertedGroups[Math.floor(Math.random() * insertedGroups.length)].id],
            });
        }
        
        const { error: newStudentsError } = await supabase.from('students').insert(studentsToCreate);
        if (newStudentsError) { 
            showNotification(`Ошибка создания учеников: ${newStudentsError.message}`, 'error');
        } else {
            showNotification('База данных успешно заполнена тестовыми данными.', 'success');
        }
    }, [showNotification]);

    const fetchUserProfile = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        // Try to get profile
        let { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

        if (!profile) {
            // Profile doesn't exist. Check if this is the FIRST user ever in profiles
            const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
            const isFirstUser = count === 0;

            const newProfile: UserProfile = {
                id: session.user.id,
                email: session.user.email || '',
                role: isFirstUser ? 'admin' : 'teacher',
                permissions: isFirstUser ? adminPermissions : defaultPermissions
            };

            const { data: createdProfile, error: createError } = await supabase.from('profiles').insert(newProfile).select().single();
            if (createError) {
                console.error("Error creating profile:", createError);
            } else {
                profile = createdProfile;
            }
        }

        if (profile) {
            setUserProfile(profile);
            // If admin, fetch all profiles
            if (profile.role === 'admin') {
                const { data: all } = await supabase.from('profiles').select('*').order('email');
                if (all) setAllProfiles(all);
            }
        }
    };

    const updateUserProfile = async (id: string, updates: Partial<UserProfile>) => {
        setIsSaving(true);
        const { error } = await supabase.from('profiles').update(updates).eq('id', id);
        if (error) {
            showNotification(`Ошибка обновления профиля: ${error.message}`, 'error');
        } else {
            showNotification('Профиль обновлен', 'success');
            await fetchUserProfile(); // Refresh
        }
        setIsSaving(false);
    }

    const fetchData = useCallback(async (isInitialLoad = true) => {
        if (isInitialLoad) setIsLoading(true);
        try {
            await fetchUserProfile();

            const results = await Promise.all([
                supabase.from('students').select('*').order('name'),
                supabase.from('groups').select('*').order('name'),
                supabase.from('subscription_plans').select('*'),
                supabase.from('student_subscriptions').select('*').order('purchase_date', { ascending: false }),
                supabase.from('attendance').select('*'),
                supabase.from('financial_transactions').select('*').order('date', { ascending: false }),
                supabase.from('schedule_events').select('*'),
                supabase.from('schedule_event_exceptions').select('*'),
                supabase.from('expenses').select('*').order('date', { ascending: false }),
            ]);
    
            const errors = results.map((res) => res.error).filter(Boolean);
            if (errors.length > 0) throw new Error(errors.map(e => e!.message).join('\n'));
    
            const [
                { data: studentsRaw }, { data: groupsRaw }, { data: plansRaw },
                { data: studentSubsRaw }, { data: attendanceRaw }, { data: transactionsRaw },
                { data: eventsRaw }, { data: exceptionsRaw }, { data: expensesRaw },
            ] = results;

            if (isInitialLoad && (!studentsRaw || studentsRaw.length === 0)) {
                await seedDatabase();
                await fetchData(false); // Refetch after seeding
                return;
            }
            
            const sanitize = (data: any[] | null | undefined) => Array.isArray(data) ? data : [];

            const sanitizedGroups = sanitize(groupsRaw).filter(g => g && g.id && g.name).map(g => ({...g}));
            
            const sanitizedPlans = sanitize(plansRaw).filter(p => p && p.id).map(p => ({
                ...p,
                name: p.name || 'Без имени',
                price: typeof p.price === 'number' ? p.price : 0,
                discount: typeof p.discount === 'number' ? p.discount : 0,
                lesson_count: typeof p.lesson_count === 'number' ? p.lesson_count : 0,
            }));

            const sanitizedStudentSubs = sanitize(studentSubsRaw)
                .filter(s => s && s.id && s.student_id && s.subscription_plan_id && s.purchase_date && typeof s.price_paid === 'number' && typeof s.lessons_total === 'number')
                .map(s => ({
                    ...s,
                    lessons_attended: typeof s.lessons_attended === 'number' ? s.lessons_attended : 0,
                    assigned_group_id: s.assigned_group_id || null,
                }));

            const sanitizedAttendance = sanitize(attendanceRaw).filter(a => a && a.student_id && a.date && a.status).map(a => ({...a}));
            
            const sanitizedTransactions = sanitize(transactionsRaw)
                .filter(t => t && t.id && t.student_id && t.date && t.type && typeof t.amount === 'number')
                .map(t => ({
                    ...t,
                    description: t.description || '',
                }));
            
            const sanitizedEvents = sanitize(eventsRaw)
                .filter(e => e && e.id && e.start && e.end && e.title && !isNaN(new Date(e.start).getTime()))
                .map(e => ({
                    ...e,
                    is_recurring: !!e.is_recurring,
                }));

            const sanitizedExceptions = sanitize(exceptionsRaw).filter(e => e && e.original_event_id && e.original_start_time).map(e => ({...e}));

            const sanitizedExpenses = sanitize(expensesRaw)
                .filter(e => e && e.id && e.date && typeof e.amount === 'number')
                .map(e => ({
                    ...e,
                    description: e.description || 'Без описания',
                }));

            const sanitizedStudents = sanitize(studentsRaw).filter(s => s && s.id).map(s => ({
                ...s,
                name: s.name || 'Имя не указано',
                balance: typeof s.balance === 'number' ? s.balance : 0,
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
    
            const enrichedStudents = sanitizedStudents.map(s => ({
                ...s,
                subscriptions: sanitizedStudentSubs.filter(sub => sub.student_id === s.id),
                transactions: sanitizedTransactions.filter(tx => tx.student_id === s.id),
            }));
    
            setStudents(enrichedStudents);
    
        } catch (error: any) {
            showNotification(`Критическая ошибка загрузки данных: ${error.message}`, 'error');
        } finally {
             if (isInitialLoad) setIsLoading(false);
        }
    }, [seedDatabase, showNotification]);

    const allVisibleEvents = useMemo(() => {
        const allEvents: DisplayEvent[] = [];
        const exceptionsMap: Map<string, ScheduleEventException> = new Map(eventExceptions.map(ex => [`${ex.original_event_id}-${ex.original_start_time}`, ex]));
    
        scheduleEvents.forEach(event => {
            if (!event) return; // Prevent crash on null records
            if (!event.start || !event.end) {
                console.error('Event with missing start/end date:', event);
                return;
            }
            const startDate = new Date(event.start);
            const endDate = new Date(event.end);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                console.error('Event with invalid start/end date:', event);
                return;
            }
            
            allEvents.push({ 
                ...event, 
                originalId: event.id, 
                isVirtual: false,
                occurrence_key: getOccurrenceKey(startDate)
            });
    
            if (event.is_recurring) {
                const duration = endDate.getTime() - startDate.getTime();
                const nextDate = new Date(startDate);
    
                for (let i = 1; i <= 52; i++) { // Generate for 1 year
                    nextDate.setDate(nextDate.getDate() + 7);
                    
                    const occurrenceStartDate = new Date(nextDate);
                    const occurrenceKey = getOccurrenceKey(occurrenceStartDate);
                    const exception = exceptionsMap.get(`${event.id}-${occurrenceKey}`);
    
                    if (exception?.is_deleted) {
                        continue;
                    }
                    
                    const finalStartStr = exception?.new_start_time || occurrenceStartDate.toISOString();
                    const finalStartDate = new Date(finalStartStr);
                    if (isNaN(finalStartDate.getTime())) {
                        console.error('Skipping recurring instance due to invalid start date:', { event, exception });
                        continue;
                    }
    
                    const finalEndDate = exception?.new_end_time 
                        ? new Date(exception.new_end_time) 
                        : new Date(finalStartDate.getTime() + duration);
                    
                    if (isNaN(finalEndDate.getTime())) {
                        console.error('Skipping recurring instance due to invalid end date:', { event, exception });
                        continue;
                    }
    
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
    }, [scheduleEvents, eventExceptions]);

    useEffect(() => {
        fetchData(true);
    }, [fetchData]);

    const addStudent = async (student: StudentForCreation): Promise<Student | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('students').insert(student).select().single();
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
        const { data, error } = await supabase.from('students').insert(students).select();
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return null; }
        if (data) {
            data.forEach(s => notificationService.sendWelcomeEmail(s as Student));
            await fetchData(false);
            setIsSaving(false);
            return data as Student[];
        }
        setIsSaving(false);
        return null;
    };

    const updateStudent = async (id: string, updates: Partial<Student>): Promise<Student | null> => {
        setIsSaving(true);
        // Exclude join fields from update payload
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { subscriptions, transactions, ...updatePayload } = updates;
        const { data, error } = await supabase.from('students').update(updatePayload).eq('id', id).select().single();
        
        if (error) {
            showNotification(`Ошибка обновления ученика: ${error.message}`, 'error');
            setIsSaving(false);
            return null;
        }
        await fetchData(false);
        setIsSaving(false);
        return data as Student;
    };

    const deleteStudents = async (ids: string[]): Promise<boolean> => {
        setIsSaving(true);
        const { error } = await supabase.from('students').delete().in('id', ids);
        if (error) {
            showNotification(`Ошибка удаления: ${error.message}`, 'error');
            setIsSaving(false);
            return false;
        }
        await fetchData(false);
        setIsSaving(false);
        return true;
    };

    // Groups
    const addGroup = async (group: GroupForCreation): Promise<Group | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('groups').insert(group).select().single();
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return null; }
        await fetchData(false); setIsSaving(false); return data as Group;
    };

    const updateGroup = async (id: string, updates: Partial<Group>): Promise<Group | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('groups').update(updates).eq('id', id).select().single();
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return null; }
        await fetchData(false); setIsSaving(false); return data as Group;
    };

    const deleteGroup = async (id: string): Promise<boolean> => {
        setIsSaving(true);
        const { error } = await supabase.from('groups').delete().eq('id', id);
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return false; }
        await fetchData(false); setIsSaving(false); return true;
    };

    // Subscription Plans
    const addSubscriptionPlan = async (plan: SubscriptionPlanForCreation): Promise<SubscriptionPlan | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('subscription_plans').insert(plan).select().single();
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return null; }
        await fetchData(false); setIsSaving(false); return data as SubscriptionPlan;
    };

    const updateSubscriptionPlan = async (id: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | null> => {
        setIsSaving(true);
        if (updates.is_default) {
            // Unset other defaults
            await supabase.from('subscription_plans').update({ is_default: false }).neq('id', id);
        }
        const { data, error } = await supabase.from('subscription_plans').update(updates).eq('id', id).select().single();
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return null; }
        await fetchData(false); setIsSaving(false); return data as SubscriptionPlan;
    };

    const deleteSubscriptionPlan = async (id: string): Promise<boolean> => {
        setIsSaving(true);
        const { error } = await supabase.from('subscription_plans').delete().eq('id', id);
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return false; }
        await fetchData(false); setIsSaving(false); return true;
    };

    // Student Subscriptions & Finance
    const addStudentSubscription = async (sub: StudentSubscriptionForCreation): Promise<StudentSubscription | null> => {
        setIsSaving(true);
        
        // 1. Create Subscription
        const { data: newSub, error: subError } = await supabase.from('student_subscriptions').insert(sub).select().single();
        if (subError) { showNotification(subError.message, 'error'); setIsSaving(false); return null; }

        // 2. Create Transaction (Payment)
        const transaction: FinancialTransactionForCreation = {
            student_id: sub.student_id,
            type: 'payment',
            amount: sub.price_paid,
            description: 'Оплата абонемента',
            student_subscription_id: newSub.id
        };
        const { error: txError } = await supabase.from('financial_transactions').insert(transaction);
        if (txError) { console.error(txError); showNotification('Ошибка создания транзакции', 'error'); }

        await fetchData(false);
        setIsSaving(false);
        showNotification('Абонемент добавлен и оплата зафиксирована.');
        return newSub as StudentSubscription;
    };

    const updateStudentSubscription = async (id: string, updates: Partial<StudentSubscription>): Promise<StudentSubscription | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('student_subscriptions').update(updates).eq('id', id).select().single();
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return null; }
        await fetchData(false); setIsSaving(false); return data as StudentSubscription;
    };

    const refundToBalanceAndCancelSubscription = async (subscriptionId: string): Promise<void> => {
        setIsSaving(true);
        const sub = studentSubscriptions.find(s => s.id === subscriptionId);
        if (!sub) { setIsSaving(false); return; }
        
        const lessonsRemaining = sub.lessons_total - sub.lessons_attended;
        const pricePerLesson = sub.lessons_total > 0 ? sub.price_paid / sub.lessons_total : 0;
        const refundAmount = lessonsRemaining * pricePerLesson;

        // 1. Create Refund Transaction
        await supabase.from('financial_transactions').insert({
            student_id: sub.student_id,
            type: 'refund',
            amount: refundAmount,
            description: `Возврат на баланс (Абонемент #${sub.id.slice(0,4)})`,
            student_subscription_id: sub.id
        });

        // 2. Cancel Subscription (delete)
        await supabase.from('student_subscriptions').delete().eq('id', subscriptionId);
        
        await fetchData(false);
        setIsSaving(false);
        showNotification('Средства возвращены на баланс, абонемент аннулирован.');
    };

    const processCashRefundAndCancelSubscription = async (subscriptionId: string): Promise<void> => {
        setIsSaving(true);
        const sub = studentSubscriptions.find(s => s.id === subscriptionId);
        if (!sub) { setIsSaving(false); return; }
        
        const lessonsRemaining = sub.lessons_total - sub.lessons_attended;
        const pricePerLesson = sub.lessons_total > 0 ? sub.price_paid / sub.lessons_total : 0;
        const refundAmount = lessonsRemaining * pricePerLesson;

        // 1. Create Refund Transaction (cash flow out)
        await supabase.from('financial_transactions').insert({
            student_id: sub.student_id,
            type: 'refund',
            amount: refundAmount,
            description: `Возврат средств наличными (Абонемент #${sub.id.slice(0,4)})`,
            student_subscription_id: sub.id
        });

        await supabase.from('student_subscriptions').delete().eq('id', subscriptionId);

        await fetchData(false);
        setIsSaving(false);
        showNotification('Средства возвращены наличными, абонемент аннулирован.');
    };

    const addTransaction = async (transaction: FinancialTransactionForCreation): Promise<FinancialTransaction | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('financial_transactions').insert(transaction).select().single();
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return null; }
        await fetchData(false); setIsSaving(false); return data as FinancialTransaction;
    };

    // Attendance
    const setAttendanceRecord = async (record: AttendanceForCreation, groupId: string): Promise<void> => {
        setIsSaving(true);
        try {
            const existing = attendance.find(a => a.student_id === record.student_id && a.date === record.date);
            
            if (record.status === 'present' || record.status === 'absent') {
                const student = students.find(s => s.id === record.student_id);
                const activeSubs = student?.subscriptions?.filter(s => s.lessons_attended < s.lessons_total) || [];
                
                let subToUse = activeSubs.find(s => s.assigned_group_id === groupId);
                if (!subToUse) subToUse = activeSubs.find(s => s.assigned_group_id === null);

                if (subToUse && !existing?.student_subscription_id) {
                     const { error: upError } = await supabase.from('student_subscriptions')
                        .update({ lessons_attended: subToUse.lessons_attended + 1 })
                        .eq('id', subToUse.id);
                     if (upError) throw upError;
                     
                     record.student_subscription_id = subToUse.id;
                } else if (existing?.student_subscription_id) {
                    record.student_subscription_id = existing.student_subscription_id;
                }
            }

            const { error } = await supabase.from('attendance').upsert(record);
            if (error) throw error;
        } catch (err: any) {
            showNotification(`Ошибка: ${err.message}`, 'error');
        } finally {
            await fetchData(false);
            setIsSaving(false);
        }
    };

    const deleteAttendanceRecord = async (studentId: string, date: string): Promise<void> => {
        setIsSaving(true);
        try {
            const existing = attendance.find(a => a.student_id === studentId && a.date === date);
            if (existing?.student_subscription_id) {
                const sub = studentSubscriptions.find(s => s.id === existing.student_subscription_id);
                if (sub) {
                    const newCount = Math.max(0, sub.lessons_attended - 1);
                    const { error: downError } = await supabase.from('student_subscriptions')
                        .update({ lessons_attended: newCount })
                        .eq('id', sub.id);
                    if (downError) throw downError;
                }
            }
            
            const { error } = await supabase.from('attendance').delete().eq('student_id', studentId).eq('date', date);
            if (error) throw error;

        } catch (err: any) {
            showNotification(`Ошибка удаления: ${err.message}`, 'error');
        } finally {
            await fetchData(false);
            setIsSaving(false);
        }
    };

    // Schedule
    const addScheduleEvent = async (event: ScheduleEventForCreation): Promise<ScheduleEvent | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('schedule_events').insert(event).select().single();
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return null; }
        await fetchData(false); setIsSaving(false); return data as ScheduleEvent;
    };

    const updateScheduleEvent = async (id: string, updates: Partial<ScheduleEvent>): Promise<ScheduleEvent | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('schedule_events').update(updates).eq('id', id).select().single();
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return null; }
        await fetchData(false); setIsSaving(false); return data as ScheduleEvent;
    };

    const deleteScheduleEvent = async (id: string): Promise<boolean> => {
        setIsSaving(true);
        const { error } = await supabase.from('schedule_events').delete().eq('id', id);
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return false; }
        await fetchData(false); setIsSaving(false); return true;
    };

    const addEventException = async (exception: ScheduleEventException): Promise<ScheduleEventException | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('schedule_event_exceptions').upsert(exception).select().single();
         if (error) { showNotification(error.message, 'error'); setIsSaving(false); return null; }
        await fetchData(false); setIsSaving(false); return data as ScheduleEventException;
    };

    // Expenses
    const addExpense = async (expense: ExpenseForCreation): Promise<Expense | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('expenses').insert(expense).select().single();
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return null; }
        await fetchData(false); setIsSaving(false); return data as Expense;
    };

    const updateExpense = async (id: string, updates: Partial<Omit<Expense, 'id'>>): Promise<Expense | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('expenses').update(updates).eq('id', id).select().single();
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return null; }
        await fetchData(false); setIsSaving(false); return data as Expense;
    };

    const deleteExpense = async (id: string): Promise<boolean> => {
        setIsSaving(true);
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return false; }
        await fetchData(false); setIsSaving(false); return true;
    };

    const clearStudentFinancialData = async (): Promise<void> => {
        setIsSaving(true);
        // Delete all transactions, subscriptions, attendance
        await supabase.from('financial_transactions').delete().neq('id', SYSTEM_SUBSCRIPTION_PLAN_ID); 
        await supabase.from('student_subscriptions').delete().neq('id', SYSTEM_SUBSCRIPTION_PLAN_ID);
        await supabase.from('attendance').delete().neq('student_id', SYSTEM_SUBSCRIPTION_PLAN_ID);
        // Reset student balances
        await supabase.from('students').update({ balance: 0 }).neq('id', SYSTEM_SUBSCRIPTION_PLAN_ID);
        
        await fetchData(false);
        setIsSaving(false);
        showNotification('Финансовые данные очищены.', 'success');
    };

    const value: IAppContext = {
        userProfile, allProfiles,
        students, groups, subscriptionPlans, attendance, transactions, scheduleEvents, eventExceptions, allVisibleEvents, expenses,
        notifications, isLoading, isSaving,
        showNotification,
        addStudent, addStudents, updateStudent, deleteStudents,
        addGroup, updateGroup, deleteGroup,
        addSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan,
        addStudentSubscription, updateStudentSubscription, refundToBalanceAndCancelSubscription, processCashRefundAndCancelSubscription,
        addTransaction,
        setAttendanceRecord, deleteAttendanceRecord,
        addScheduleEvent, updateScheduleEvent, deleteScheduleEvent, addEventException,
        addExpense, updateExpense, deleteExpense,
        clearStudentFinancialData,
        updateUserProfile
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
