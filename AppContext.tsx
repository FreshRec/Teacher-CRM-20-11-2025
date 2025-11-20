import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from './services/supabaseClient';
import { 
    Student, Group, SubscriptionPlan, Attendance, FinancialTransaction, StudentSubscription, ScheduleEvent, ScheduleEventException,
    Expense,
    StudentForCreation, GroupForCreation, SubscriptionPlanForCreation, StudentSubscriptionForCreation, 
    FinancialTransactionForCreation, AttendanceForCreation, ScheduleEventForCreation, ScheduleEventExceptionForCreation,
    ExpenseForCreation,
    IAppContext,
    DisplayEvent
} from './types';
import { notificationService } from './services/notificationService';

export const SYSTEM_SUBSCRIPTION_PLAN_ID = '00000000-0000-0000-0000-000000000000';
export const DEFAULT_LESSON_PRICE = 0; // Default price for a debt lesson

const AppContext = createContext<IAppContext | null>(null);

const getOccurrenceKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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

    const fetchData = useCallback(async (isInitialLoad = true) => {
        if (isInitialLoad) setIsLoading(true);
        try {
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
            if (errors.length > 0) throw new Error(errors.map(e => e.message).join('\n'));
    
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
                let nextDate = new Date(startDate);
    
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
        const { subscriptions, transactions, ...updatePayload } = updates;
        const { data, error } = await supabase.from('students').update(updatePayload).eq('id', id).select().single();
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data as Student;
    };

    const deleteStudents = async (ids: string[]): Promise<boolean> => {
        setIsSaving(true);
        try {
            const { error: txError } = await supabase.from('financial_transactions').delete().in('student_id', ids);
            if (txError) throw txError;

            const { error: attendanceError } = await supabase.from('attendance').delete().in('student_id', ids);
            if (attendanceError) throw attendanceError;

            const { error: subError } = await supabase.from('student_subscriptions').delete().in('student_id', ids);
            if (subError) throw subError;

            const { error: studentError } = await supabase.from('students').delete().in('id', ids);
            if (studentError) throw studentError;

            await fetchData(false);
            return true;
        } catch (error: any) {
            showNotification(`Ошибка при удалении: ${error.message}`, 'error');
            return false;
        } finally {
            setIsSaving(false);
        }
    };
    
    const addGroup = async (group: GroupForCreation): Promise<Group | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('groups').insert(group).select().single();
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };
    
    const updateGroup = async (id: string, updates: Partial<Group>): Promise<Group | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('groups').update(updates).eq('id', id).select().single();
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };
    
    const deleteGroup = async (id: string): Promise<boolean> => {
        setIsSaving(true);
        try {
            // 1. Find all students associated with this group ID directly from the database.
            const { data: studentsToUpdate, error: fetchError } = await supabase
                .from('students')
                .select('id, group_ids')
                .contains('group_ids', [id]);
    
            if (fetchError) throw fetchError;
    
            // 2. Create and execute update promises for each affected student.
            const studentUpdatePromises = (studentsToUpdate || []).map(student => {
                const newGroupIds = student.group_ids.filter(groupId => groupId !== id);
                return supabase.from('students').update({ group_ids: newGroupIds }).eq('id', student.id);
            });
    
            const studentUpdateResults = await Promise.all(studentUpdatePromises);
            const studentUpdateError = studentUpdateResults.find(res => res.error);
            if (studentUpdateError) throw studentUpdateError.error;
    
            // 3. Once students are updated successfully, delete the group.
            const { error: groupDeleteError } = await supabase.from('groups').delete().eq('id', id);
            if (groupDeleteError) throw groupDeleteError;
    
            await fetchData(false);
            return true;
        } catch (error: any) {
            showNotification(`Ошибка при удалении группы: ${error.message}`, 'error');
            return false;
        } finally {
            setIsSaving(false);
        }
    };
    
    const addSubscriptionPlan = async (plan: SubscriptionPlanForCreation): Promise<SubscriptionPlan | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('subscription_plans').insert(plan).select().single();
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };

    const updateSubscriptionPlan = async (id: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | null> => {
        setIsSaving(true);
        if (updates.is_default) {
            await supabase.from('subscription_plans').update({ is_default: false }).neq('id', id);
        }
        const { data, error } = await supabase.from('subscription_plans').update(updates).eq('id', id).select().single();
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };
    
    const deleteSubscriptionPlan = async (id: string): Promise<boolean> => {
        setIsSaving(true);
        const { error } = await supabase.from('subscription_plans').delete().eq('id', id);
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return false; }
        await fetchData(false);
        setIsSaving(false);
        return true;
    };

    const addTransaction = async (transaction: FinancialTransactionForCreation): Promise<FinancialTransaction | null> => {
        const { data: txData, error: txError } = await supabase.from('financial_transactions').insert(transaction).select().single();
        if (txError) { showNotification(`Ошибка транзакции: ${txError.message}`, 'error'); return null; }

        const student = students.find(s => s.id === transaction.student_id);
        if (student) {
            let newBalance = student.balance;
            
            // Only transactions that affect the credit/debit balance should modify it.
            // 'payment' for a subscription is a record of cash flow, not a deposit to credit.
            if (transaction.type === 'refund' || transaction.type === 'correction') {
                newBalance += transaction.amount;
            } else if (transaction.type === 'debit') {
                newBalance -= transaction.amount;
            }
            // `payment` type is now ignored for balance updates.

            if (newBalance !== student.balance) {
                await supabase.from('students').update({ balance: newBalance }).eq('id', student.id);
            }
        }
        return txData;
    };
    
    const addStudentSubscription = async (sub: StudentSubscriptionForCreation): Promise<StudentSubscription | null> => {
        setIsSaving(true);
        try {
            const { data: newSubData, error } = await supabase.from('student_subscriptions').insert(sub).select().single();
            if (error || !newSubData) throw error || new Error("Failed to create subscription");

            const plan = subscriptionPlans.find(p => p.id === sub.subscription_plan_id);
            await addTransaction({
                student_id: sub.student_id,
                type: 'payment',
                amount: sub.price_paid,
                description: `Оплата абонемента: ${plan?.name || ''}`,
                student_subscription_id: newSubData.id,
            });
            
            const { data: debtAttendanceData } = await supabase.from('attendance').select('*').eq('student_id', sub.student_id).is('student_subscription_id', null).in('status', ['present', 'absent']);
            const debtAttendance = debtAttendanceData || [];
            
            let lessonsToDeduct = 0;
            if (debtAttendance.length > 0) {
                lessonsToDeduct = Math.min(debtAttendance.length, newSubData.lessons_total);
                
                const attendanceToUpdate = debtAttendance.slice(0, lessonsToDeduct);
                await supabase.from('attendance').upsert(attendanceToUpdate.map(a => ({...a, student_subscription_id: newSubData.id})));
                
                const debtAmountToClear = lessonsToDeduct * DEFAULT_LESSON_PRICE;
                if (debtAmountToClear > 0) {
                    await addTransaction({
                        student_id: sub.student_id,
                        type: 'correction',
                        amount: debtAmountToClear,
                        description: `Списание долга (${lessonsToDeduct} занятий)`
                    });
                }
            }
            
            if (lessonsToDeduct > 0) {
                await supabase.from('student_subscriptions').update({ lessons_attended: lessonsToDeduct }).eq('id', newSubData.id);
                showNotification(`Абонемент добавлен. ${lessonsToDeduct} долговых занятий было списано.`, 'success');
            } else {
                showNotification('Абонемент успешно добавлен и оплачен.', 'success');
            }
            
            await fetchData(false);
            return newSubData;
        } catch(error: any) {
            showNotification(error.message, 'error');
            return null;
        } finally {
            setIsSaving(false);
        }
    };
    
    const updateStudentSubscription = async (id: string, updates: Partial<StudentSubscription>): Promise<StudentSubscription | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('student_subscriptions').update(updates).eq('id', id).select().single();
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };

    const refundToBalanceAndCancelSubscription = async (subscriptionId: string): Promise<void> => {
        setIsSaving(true);
        try {
            const sub = studentSubscriptions.find(s => s.id === subscriptionId);
            if (!sub) return;
            
            const singleLessonPrice = sub.lessons_total > 0 ? sub.price_paid / sub.lessons_total : 0;
            const remainingLessons = sub.lessons_total - sub.lessons_attended;
            const refundAmount = Math.round(singleLessonPrice * remainingLessons);

            if (refundAmount > 0) {
                const plan = subscriptionPlans.find(p => p.id === sub.subscription_plan_id);
                await addTransaction({
                    student_id: sub.student_id,
                    type: 'refund',
                    amount: refundAmount,
                    description: `Возврат на баланс за ${plan?.name || ''} (${remainingLessons} занятий)`,
                    student_subscription_id: sub.id
                });
            }

            await supabase.from('student_subscriptions').delete().eq('id', sub.id);
            showNotification('Абонемент аннулирован, средства возвращены на баланс.', 'success');
        } catch(e: any) {
            showNotification(e.message, 'error');
        } finally {
            await fetchData(false);
            setIsSaving(false);
        }
    };

    const processCashRefundAndCancelSubscription = async (subscriptionId: string): Promise<void> => {
        setIsSaving(true);
        try {
            const sub = studentSubscriptions.find(s => s.id === subscriptionId);
            if (!sub) return;
    
            const singleLessonPrice = sub.lessons_total > 0 ? sub.price_paid / sub.lessons_total : 0;
            const remainingLessons = sub.lessons_total - sub.lessons_attended;
            const refundAmount = Math.round(singleLessonPrice * remainingLessons);
            
            if (refundAmount > 0) {
                const plan = subscriptionPlans.find(p => p.id === sub.subscription_plan_id);
                // Directly insert transaction without updating student balance
                const { error: txError } = await supabase.from('financial_transactions').insert({
                    student_id: sub.student_id,
                    type: 'refund', // Log as a refund for record-keeping
                    amount: refundAmount,
                    description: `Возврат наличными за ${plan?.name || ''}`,
                    student_subscription_id: sub.id
                });
                if (txError) throw txError;
            }
    
            await supabase.from('student_subscriptions').delete().eq('id', sub.id);
            showNotification('Абонемент аннулирован, возврат наличными зафиксирован.', 'success');
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally {
            await fetchData(false);
            setIsSaving(false);
        }
    };
    
    const setAttendanceRecord = async (record: AttendanceForCreation, groupId: string): Promise<void> => {
        setIsSaving(true);
        try {
            const student = students.find(s => s.id === record.student_id);
            if (!student) throw new Error("Student not found");

            const { data: existingRecords } = await supabase.from('attendance').select('*').eq('student_id', record.student_id).eq('date', record.date);
            const existingRecord = existingRecords?.[0];

            const isNewVisit = record.status === 'present' || record.status === 'absent';
            const wasPreviouslyVisit = existingRecord && (existingRecord.status === 'present' || existingRecord.status === 'absent');
            
            // Case 1: A visit is being added or status is changed TO a visit
            if (isNewVisit && !wasPreviouslyVisit) {
                const applicableSub = student.subscriptions?.find(s => 
                    (s.assigned_group_id === groupId || !s.assigned_group_id) && s.lessons_attended < s.lessons_total
                );

                if (applicableSub) {
                    await supabase.from('student_subscriptions').update({ lessons_attended: applicableSub.lessons_attended + 1 }).eq('id', applicableSub.id);
                    record.student_subscription_id = applicableSub.id;
                } else {
                    record.student_subscription_id = null;
                    if (DEFAULT_LESSON_PRICE > 0) {
                        await addTransaction({
                            student_id: record.student_id,
                            type: 'debit',
                            amount: DEFAULT_LESSON_PRICE,
                            description: `Занятие в долг ${new Date(record.date).toLocaleDateString('ru-RU')}`
                        });
                    }
                }
            }
            // Case 2: A visit is being cancelled (changed FROM visit TO something else)
            else if (!isNewVisit && wasPreviouslyVisit) {
                if (existingRecord.student_subscription_id) {
                    const sub = studentSubscriptions.find(s => s.id === existingRecord.student_subscription_id);
                    if (sub && sub.lessons_attended > 0) {
                         await supabase.from('student_subscriptions').update({ lessons_attended: sub.lessons_attended - 1 }).eq('id', sub.id);
                    }
                } else { // It was a debt lesson, so we refund the debt.
                    if (DEFAULT_LESSON_PRICE > 0) {
                        await addTransaction({
                            student_id: record.student_id,
                            type: 'correction',
                            amount: DEFAULT_LESSON_PRICE,
                            description: `Отмена списания за занятие ${new Date(record.date).toLocaleDateString('ru-RU')}`
                        });
                    }
                }
                record.student_subscription_id = null; // Clear the subscription link as it's no longer a visit
            }
            // Case 3: Status isn't changing regarding visit status (e.g., present -> absent, or just updating grade), so keep the sub ID.
            else if (existingRecord) {
                 record.student_subscription_id = existingRecord.student_subscription_id;
            }

            const { data: upsertedData, error } = await supabase.from('attendance').upsert({ ...record, grade: record.grade === undefined ? null : record.grade }, { onConflict: 'student_id,date' }).select().single();
            if (error) throw error;
            
            if (upsertedData) {
                setAttendance(prev => {
                    const recordExists = prev.some(a => a.student_id === upsertedData.student_id && a.date === upsertedData.date);
                    if (recordExists) {
                        return prev.map(a => (a.student_id === upsertedData.student_id && a.date === upsertedData.date) ? upsertedData : a);
                    } else {
                        return [...prev, upsertedData];
                    }
                });
            }
            
        } catch (error: any) {
            showNotification(`Ошибка: ${error.message}`, 'error');
        } finally {
            await fetchData(false);
            setIsSaving(false);
        }
    };

    const deleteAttendanceRecord = async (studentId: string, date: string): Promise<void> => {
        setIsSaving(true);
        try {
            const { data: existingRecords } = await supabase.from('attendance').select('*').eq('student_id', studentId).eq('date', date);
            const existingRecord = existingRecords?.[0];
            if (!existingRecord) return;
        
            const wasDebtLesson = (existingRecord.status === 'present' || existingRecord.status === 'absent') && !existingRecord.student_subscription_id;

            if (existingRecord.student_subscription_id) {
                const sub = studentSubscriptions.find(s => s.id === existingRecord.student_subscription_id);
                if (sub && sub.lessons_attended > 0) {
                     await supabase.from('student_subscriptions').update({ lessons_attended: sub.lessons_attended - 1 }).eq('id', sub.id);
                }
            } else if (wasDebtLesson) {
                if (DEFAULT_LESSON_PRICE > 0) {
                    const debtDescription = `Занятие в долг ${new Date(date).toLocaleDateString('ru-RU')}`;
                    const { data: debtTxData, error: findTxError } = await supabase
                        .from('financial_transactions')
                        .select('id, amount')
                        .eq('student_id', studentId)
                        .eq('type', 'debit')
                        .eq('description', debtDescription)
                        .order('date', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (findTxError) {
                        console.error("Error finding transaction to delete:", findTxError);
                    }
                    
                    if (debtTxData) {
                        const { error: deleteTxError } = await supabase.from('financial_transactions').delete().eq('id', debtTxData.id);
                        if (deleteTxError) throw deleteTxError;

                        const { data: student, error: studentError } = await supabase.from('students').select('balance').eq('id', studentId).single();
                        if (studentError) throw studentError;
                        
                        if (student) {
                            const newBalance = student.balance + debtTxData.amount;
                            const { error: updateStudentError } = await supabase.from('students').update({ balance: newBalance }).eq('id', studentId);
                            if (updateStudentError) throw updateStudentError;
                        }
                    }
                }
            }

            const { error } = await supabase.from('attendance').delete().match({ student_id: studentId, date });
            if (error) throw error;
            
        } catch (error: any) {
             showNotification(`Ошибка удаления отметки: ${error.message}`, 'error');
        } finally {
            await fetchData(false);
            setIsSaving(false);
        }
    };
    
    const addScheduleEvent = async (event: ScheduleEventForCreation): Promise<ScheduleEvent | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('schedule_events').insert(event).select().single();
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };
    
    const updateScheduleEvent = async (id: string, updates: Partial<ScheduleEvent>): Promise<ScheduleEvent | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('schedule_events').update(updates).eq('id', id).select().single();
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };
    
    const deleteScheduleEvent = async (id: string): Promise<boolean> => {
        setIsSaving(true);
        const { error } = await supabase.from('schedule_events').delete().eq('id', id);
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return false; }
        await fetchData(false);
        setIsSaving(false);
        return true;
    };
    
    const addEventException = async (exception: ScheduleEventException): Promise<ScheduleEventException | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('schedule_event_exceptions').upsert(exception, { onConflict: 'original_event_id,original_start_time' }).select().single();
        if (error) { showNotification(error.message, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };

    const addExpense = async (expense: ExpenseForCreation): Promise<Expense | null> => {
        setIsSaving(true);
        const expenseToInsert = {
            ...expense,
            date: expense.date || new Date().toISOString(),
        };
        const { data, error } = await supabase.from('expenses').insert(expenseToInsert).select().single();
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };

    const updateExpense = async (id: string, updates: Partial<Omit<Expense, 'id'>>): Promise<Expense | null> => {
        setIsSaving(true);
        const { data, error } = await supabase.from('expenses').update(updates).eq('id', id).select().single();
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return null; }
        await fetchData(false);
        setIsSaving(false);
        return data;
    };

    const deleteExpense = async (id: string): Promise<boolean> => {
        setIsSaving(true);
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) { showNotification(`Ошибка: ${error.message}`, 'error'); setIsSaving(false); return false; }
        await fetchData(false);
        setIsSaving(false);
        return true;
    };
    
    const clearStudentFinancialData = async (): Promise<void> => {
        setIsSaving(true);
        try {
            const { error: attendanceError } = await supabase.from('attendance').delete().not('student_id', 'is', null);
            if (attendanceError) throw attendanceError;

            const { error: subsError } = await supabase.from('student_subscriptions').delete().not('id', 'is', null);
            if (subsError) throw subsError;

            const { error: transactionsError } = await supabase.from('financial_transactions').delete().not('id', 'is', null);
            if (transactionsError) throw transactionsError;

            const { error: studentsError } = await supabase.from('students').update({ balance: 0 }).not('id', 'is', null);
            if (studentsError) throw studentsError;

            showNotification('Все финансовые данные учеников и история посещаемости очищены.', 'success');
        } catch (error: any) {
            showNotification(`Ошибка очистки: ${error.message}.`, 'error');
        } finally {
            await fetchData(false);
            setIsSaving(false);
        }
    };

    const value: IAppContext = {
        students, groups, subscriptionPlans, attendance, transactions, scheduleEvents, eventExceptions, allVisibleEvents, expenses,
        notifications, isLoading, isSaving, showNotification, addStudent, addStudents, updateStudent, deleteStudents,
        addGroup, updateGroup, deleteGroup, addSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan,
        addStudentSubscription, updateStudentSubscription, refundToBalanceAndCancelSubscription, processCashRefundAndCancelSubscription,
        addTransaction, setAttendanceRecord, deleteAttendanceRecord, addScheduleEvent, updateScheduleEvent,
        deleteScheduleEvent, addEventException, addExpense, updateExpense, deleteExpense, clearStudentFinancialData,
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

export const useAppContext = (): IAppContext => {
    const context = useContext(AppContext);
    if (context === null) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};