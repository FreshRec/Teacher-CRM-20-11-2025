import React, { useState, useMemo } from 'react';
import { FinancialTransaction, View, Attendance } from '../types';
import { useAppContext } from '../AppContext';
import { StudentEditModal } from './StudentEditModal';
import { SettingsIcon } from './icons';

interface HistoryEvent {
    id: string;
    date: string;
    description: string;
    amount: number;
    isDeposit: boolean; // For styling: true for green, false for red
    isTransaction: boolean; // To decide whether to show the amount
    balanceAfter: number;
}

const TransactionCard: React.FC<{ event: HistoryEvent }> = ({ event }) => {
    const locale = 'ru-RU';
    const sign = event.isDeposit ? '+' : '-';
    const color = event.isDeposit ? 'border-green-500' : 'border-red-500';
    const amountColor = event.isDeposit ? 'text-green-600' : 'text-red-600';

    return (
        <div className={`w-full bg-white rounded-lg shadow-md p-4 border-l-4 ${color} my-2`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm text-gray-500">{new Date(event.date).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p className="font-semibold text-gray-800">{event.description}</p>
                </div>
                {event.isTransaction && (
                    <p className={`text-lg font-bold ${amountColor}`}>{sign} {event.amount.toLocaleString(locale)} ₽</p>
                )}
            </div>
            <p className="text-right text-sm text-gray-600 mt-2">Баланс после: <span className="font-bold">{event.balanceAfter.toLocaleString(locale, { style: 'currency', currency: 'RUB' })}</span></p>
        </div>
    );
};


// Fix: Use a named export
export const StudentFinanceHistory: React.FC<{ studentId: string; navigateTo: (view: View, studentId?: string | null) => void; }> = ({ studentId, navigateTo }) => {
    const context = useAppContext();
    const { students, transactions, attendance, subscriptionPlans } = context;
    const [isEditModalOpen, setEditModalOpen] = useState(false);

    const student = useMemo(() => students.find(s => s.id === studentId), [students, studentId]);

    const processedHistory: HistoryEvent[] = useMemo(() => {
        if (!student) return [];
    
        const studentTransactions = transactions.filter(tx => tx.student_id === student.id);
        const studentAttendance = attendance.filter(a => a.student_id === student.id);
        const studentSubscriptions = student.subscriptions || [];

        const allEvents: (
            { type: 'transaction', data: FinancialTransaction, date: Date } | 
            { type: 'attendance', data: Attendance, date: Date }
        )[] = [
            ...studentTransactions.map(tx => ({ type: 'transaction' as const, data: tx, date: new Date(tx.date) })),
            ...studentAttendance
                .filter(a => (a.status === 'present' || a.status === 'absent'))
                .map(a => ({ type: 'attendance' as const, data: a, date: new Date(a.date) })),
        ]
        .filter(event => event.date && !isNaN(event.date.getTime()))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
    
        if (allEvents.length === 0) return [];
    
        const netCreditEffect = allEvents.reduce((acc, event) => {
            if (event.type === 'transaction') {
                const tx = event.data;
                if (tx.type === 'debit') return acc - tx.amount;
                if (tx.type === 'correction') return acc + tx.amount;
                if (tx.type === 'refund' && tx.description.includes('Возврат на баланс')) return acc + tx.amount;
            }
            return acc;
        }, 0);
        let runningCreditBalance = student.balance - netCreditEffect;
    
        const history: HistoryEvent[] = [];
    
        for (const event of allEvents) {
            let eventDescription = '';
            let eventDisplayAmount = 0;
            let isDepositStyle = false;
            let isTransaction = false;
    
            if (event.type === 'transaction') {
                const tx = event.data;
                if (tx.type === 'debit') runningCreditBalance -= tx.amount;
                if (tx.type === 'correction') runningCreditBalance += tx.amount;
                if (tx.type === 'refund' && tx.description.includes('Возврат на баланс')) runningCreditBalance += tx.amount;
            }
    
            const subscriptionsValueAfterEvent = studentSubscriptions.reduce((total, sub) => {
                const subPurchaseDate = new Date(sub.purchase_date);
                if (subPurchaseDate > event.date) return total;
    
                const refundTx = studentTransactions.find(tx => tx.student_subscription_id === sub.id && tx.type === 'refund' && new Date(tx.date) <= event.date);
                if (refundTx) return total;
    
                const lessonsUsed = studentAttendance.filter(a => a.student_subscription_id === sub.id && new Date(a.date) <= event.date).length;
                const remainingLessons = sub.lessons_total - lessonsUsed;
                
                if (remainingLessons > 0 && sub.lessons_total > 0) {
                    const lessonPrice = sub.price_paid / sub.lessons_total;
                    return total + (remainingLessons * lessonPrice);
                }
                
                return total;
            }, 0);
    
            const totalWorthAfterEvent = runningCreditBalance + subscriptionsValueAfterEvent;
    
            if (event.type === 'transaction') {
                const tx = event.data;
                eventDescription = tx.description;
                eventDisplayAmount = tx.amount;
                isDepositStyle = tx.type === 'payment' || tx.type === 'refund' || tx.type === 'correction';
                isTransaction = true;
            } else { // Attendance
                const att = event.data;
                if (att.student_subscription_id) {
                    const sub = studentSubscriptions.find(s => s.id === att.student_subscription_id);
                    if (sub) {
                        const plan = subscriptionPlans.find(p => p.id === sub.subscription_plan_id);
                        eventDescription = `Списано занятие по абонементу "${plan?.name || ''}"`;
                        eventDisplayAmount = sub.lessons_total > 0 ? sub.price_paid / sub.lessons_total : 0;
                        isDepositStyle = false;
                        isTransaction = false; // Don't show amount for lesson usage
                    } else {
                        continue; 
                    }
                } else {
                    continue;
                }
            }
    
            history.push({
                id: event.type === 'transaction' ? event.data.id : `${event.data.student_id}-${event.data.date}-${Math.random()}`,
                date: event.date.toISOString(),
                description: eventDescription,
                amount: eventDisplayAmount,
                isDeposit: isDepositStyle,
                isTransaction,
                balanceAfter: totalWorthAfterEvent,
            });
        }
    
        return history.reverse();
    }, [student, transactions, attendance, subscriptionPlans]);
    
    const handleSaveStudent = async (studentData: any) => {
        if (!studentData.id) return;
        
        let finalStudentData = { ...studentData };
        if (!finalStudentData.birth_date) {
            finalStudentData.birth_date = null;
        }

        const { id, ...updates } = finalStudentData;
        const result = await context.updateStudent(id, updates);
        if(result) context.showNotification('Данные ученика обновлены.');
        setEditModalOpen(false);
    };

    const handleProcessPayment = async (studentId: string, planId: string, pricePaid: number, lessonsTotal: number) => {
        await context.addStudentSubscription({
            student_id: studentId,
            subscription_plan_id: planId,
            price_paid: pricePaid,
            lessons_total: lessonsTotal,
            assigned_group_id: null,
        });
        setEditModalOpen(false); // Close modal on success
    };

    const handleAssignSubscriptionToGroup = async (subId: string, groupId: string | null) => {
        await context.updateStudentSubscription(subId, { assigned_group_id: groupId || null });
        context.showNotification('Назначение абонемента обновлено.');
    };

    if (!student) {
        return <div className="text-center p-8 text-gray-500">Ученик не найден.</div>;
    }

    return (
        <div className="bg-gray-50 p-6 rounded-lg shadow-inner">
            <div className="flex justify-between items-center mb-6">
                <button onClick={() => navigateTo('finance')} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    Назад
                </button>
                <button onClick={() => setEditModalOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center">
                    <SettingsIcon className="mr-2"/>
                    Настройки ученика
                </button>
            </div>
            
            <div className="relative p-4">
                {/* Center line */}
                <div className="absolute left-1/2 top-0 h-full w-0.5 bg-gray-300 hidden md:block"></div>

                {processedHistory.length > 0 ? processedHistory.map((event) => {
                    const isDeposit = event.isDeposit;
                    
                    return (
                        <div key={event.id} className="md:grid md:grid-cols-2 md:gap-8 relative mb-4 items-center">
                            <div className={isDeposit ? 'md:col-start-2' : ''}>
                                <TransactionCard event={event} />
                            </div>
                            {/* Timeline dot */}
                            <div className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-indigo-600 rounded-full hidden md:block"></div>
                        </div>
                    )
                }) : (
                    <div className="text-center p-8 text-gray-500 bg-white rounded-lg shadow-md">
                        Финансовая история пуста.
                    </div>
                )}
            </div>
            {student && <StudentEditModal
                isOpen={isEditModalOpen}
                onClose={() => setEditModalOpen(false)}
                student={student}
                onSave={handleSaveStudent}
                onArchive={() => student.id && context.updateStudent(student.id, { status: 'archived', archived_date: new Date().toISOString() }).then(() => navigateTo('archive'))}
                onProcessPayment={handleProcessPayment}
                onRefundToBalance={context.refundToBalanceAndCancelSubscription}
                onCashRefund={context.processCashRefundAndCancelSubscription}
                onAssignSubscriptionToGroup={handleAssignSubscriptionToGroup}
                groups={context.groups}
                subscriptionPlans={context.subscriptionPlans}
            />}
        </div>
    );
};
