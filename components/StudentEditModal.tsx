import React, { useState, useEffect } from 'react';
import { Student, Group, SubscriptionPlan, StudentSubscription, FinancialTransaction, Attendance } from '../types';
import Modal from './Modal';
import { useAppContext } from '../AppContext';


const locale = 'ru-RU';

const getTransactionStyle = (type: FinancialTransaction['type']) => {
    switch (type) {
        case 'payment':
            return { color: 'text-green-600', sign: '+' };
        case 'refund':
            return { color: 'text-green-600', sign: '+' };
        case 'correction':
            return { color: 'text-blue-600', sign: '+' };
        case 'debit':
            return { color: 'text-red-600', sign: '-' };
        default:
            return { color: 'text-gray-700', sign: '' };
    }
};

export const StudentEditModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    student: Partial<Student> | null;
    onSave: (studentData: any) => void;
    onArchive: (studentId: string) => void;
    onProcessPayment: (studentId: string, planId: string, pricePaid: number, lessonsTotal: number) => void | Promise<void>;
    onRefundToBalance: (subscriptionId: string) => void | Promise<void>;
    onCashRefund: (subscriptionId: string) => void | Promise<void>;
    onAssignSubscriptionToGroup: (subId: string, groupId: string | null) => void | Promise<void>;
    groups: Group[];
    subscriptionPlans: SubscriptionPlan[];
}> = ({ 
    isOpen, onClose, student, onSave, onArchive, onProcessPayment, onRefundToBalance, onCashRefund, onAssignSubscriptionToGroup,
    groups, subscriptionPlans
}) => {
    const { attendance } = useAppContext();

    const [formData, setFormData] = useState({
        name: '',
        birth_date: '',
        parent_name: '',
        parent_phone1: '',
        parent_phone2: '',
        group_ids: [] as string[],
    });
    
    const [paymentPlanId, setPaymentPlanId] = useState<string>('');
    const [finalAmount, setFinalAmount] = useState(0);
    const [subToCancel, setSubToCancel] = useState<StudentSubscription | null>(null);
    
    const studentAttendanceHistory = React.useMemo(() => {
        if (!student?.id) return [];
        return attendance
            .filter(a => a.student_id === student.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [attendance, student]);

    useEffect(() => {
        if (student) {
            setFormData({
                name: student.name || '',
                birth_date: student.birth_date || '',
                parent_name: student.parent_name || '',
                parent_phone1: student.parent_phone1 || '',
                parent_phone2: student.parent_phone2 || '',
                group_ids: student.group_ids || [],
            });
            setPaymentPlanId('');
        } else {
             setFormData({
                name: '',
                birth_date: '',
                parent_name: '',
                parent_phone1: '',
                parent_phone2: '',
                group_ids: [],
            });
        }
    }, [student, isOpen]);

    useEffect(() => {
        const plan = subscriptionPlans.find(p => p.id === paymentPlanId);
        if (plan) {
            const initialAmount = plan.price - plan.discount;
            setFinalAmount(initialAmount);
        } else {
            setFinalAmount(0);
        }
    }, [paymentPlanId, subscriptionPlans]);
    
    const handlePayment = () => {
        if (finalAmount >= 0 && paymentPlanId && student?.id) {
            const plan = subscriptionPlans.find(p => p.id === paymentPlanId);
            if (!plan) return;
            onProcessPayment(student.id, paymentPlanId, finalAmount, plan.lesson_count);
        }
    };
    
    const handleArchive = () => {
        if (student?.id) {
            onArchive(student.id);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleGroupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value: groupId, checked } = e.target;
        setFormData(prev => {
            const currentGroupIds = prev.group_ids || [];
            if (checked) {
                return { ...prev, group_ids: [...currentGroupIds, groupId] };
            } else {
                return { ...prev, group_ids: currentGroupIds.filter(id => id !== groupId) };
            }
        });
    };

    const handleSubmit = () => {
        const studentData: any = { 
            ...formData, 
            id: student?.id 
        };
        onSave(studentData);
    };
    
    const getPlanName = (planId: string) => subscriptionPlans.find(p => p.id === planId)?.name || 'Неизвестный план';
    
    const inputStyle = "w-full p-2 bg-gray-50 border border-gray-300 rounded-md text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white";
    
    const attendanceStatusMap = {
        present: { text: 'Был', style: 'bg-green-100 text-green-800' },
        absent: { text: 'Не был', style: 'bg-red-100 text-red-800' },
        excused: { text: 'Уваж.', style: 'bg-yellow-100 text-yellow-800' },
    };

    const gradeStyleMap: { [key: number]: string } = {
        5: 'bg-green-500 text-white',
        4: 'bg-lime-400 text-lime-900',
        3: 'bg-yellow-400 text-yellow-900',
        2: 'bg-red-500 text-white',
    };


    return (
      <>
        <Modal isOpen={isOpen} onClose={onClose} title={student?.id ? `Настройки: ${student.name}` : "Добавить ученика"}>
             <div className="max-h-[80vh] overflow-y-auto pr-2">
                <div className="space-y-4">
                    <h4 className="font-semibold text-gray-600 md:text-lg">Основная информация</h4>
                    <input name="name" value={formData.name} onChange={handleChange} placeholder="Имя ученика" className={inputStyle} required />
                    <input type="date" name="birth_date" value={formData.birth_date} onChange={handleChange} className={inputStyle} />
                    <input name="parent_name" value={formData.parent_name} onChange={handleChange} placeholder="Имя родителя" className={inputStyle} required />
                    <input name="parent_phone1" value={formData.parent_phone1} onChange={handleChange} placeholder="Телефон родителя 1" className={inputStyle} required />
                    <input name="parent_phone2" value={formData.parent_phone2} onChange={handleChange} placeholder="Телефон родителя 2 (доп.)" className={inputStyle} />
                    
                    <h4 className="font-semibold text-gray-600 md:text-lg mt-4">Группы</h4>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto bg-gray-50 p-2 rounded-md border">
                        {groups.map(g => (
                            <label key={g.id} className="flex items-center space-x-2 text-gray-800">
                                <input 
                                    type="checkbox"
                                    value={g.id}
                                    checked={formData.group_ids?.includes(g.id)}
                                    onChange={handleGroupChange}
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span>{g.name}</span>
                            </label>
                        ))}
                    </div>

                    <div className="flex justify-end mt-6 space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Отмена</button>
                        <button type="button" onClick={handleSubmit} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Сохранить</button>
                    </div>
                </div>
                
                {student?.id && (
                    <>
                        <hr className="my-6"/>

                        <div className="space-y-4">
                            <h4 className="font-semibold text-gray-600 md:text-lg">Баланс и операции</h4>
                            <div className="p-4 bg-gray-50 rounded-lg border">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="font-medium text-gray-700">Текущий общий баланс:</span>
                                    <span className={`font-bold text-xl ${(student.balance ?? 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {(student.balance ?? 0).toLocaleString(locale, { style: 'currency', currency: 'RUB' })}
                                    </span>
                                </div>
                                <h5 className="text-sm font-semibold text-gray-500 mb-2">История операций:</h5>
                                <div className="space-y-2 max-h-40 overflow-y-auto p-1">
                                    {student.transactions && student.transactions.length > 0 ? (
                                        student.transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => {
                                            const style = getTransactionStyle(tx.type);
                                            return (
                                                <div key={tx.id} className="flex justify-between items-center text-sm p-2 bg-white rounded shadow-sm">
                                                    <div>
                                                        <p className="font-medium text-gray-800 md:text-base">{tx.description}</p>
                                                        <p className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                                    </div>
                                                    <span className={`font-bold whitespace-nowrap md:text-base ${style.color}`}>
                                                        {style.sign} {tx.amount.toLocaleString(locale)} ₽
                                                    </span>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-sm text-gray-500 text-center py-2">Финансовых операций не найдено.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                         <hr className="my-6"/>

                        <div className="space-y-4">
                            <h4 className="font-semibold text-gray-600 md:text-lg">История посещений</h4>
                            <div className="p-2 bg-gray-100 rounded-lg border max-h-60 overflow-y-auto space-y-2">
                                {studentAttendanceHistory.length > 0 ? (
                                    studentAttendanceHistory.map(att => {
                                        const status = attendanceStatusMap[att.status];
                                        return (
                                        <div key={`${att.student_id}-${att.date}`} className="flex justify-between items-center p-3 bg-white rounded-md shadow-sm">
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-800">
                                                    {new Date(att.date).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}
                                                </p>
                                            </div>
                                            <div className="flex-none w-24 text-center">
                                                <span className={`px-2 py-1 text-xs font-bold rounded-full ${status.style}`}>
                                                    {status.text}
                                                </span>
                                            </div>
                                            <div className="flex-none w-28 text-right">
                                                {att.grade && (
                                                    <span className={`px-3 py-1 text-sm font-bold rounded-full ${gradeStyleMap[att.grade] || 'text-gray-800'}`}>
                                                        {att.grade}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        )
                                    })
                                ) : (
                                    <p className="text-sm text-gray-500 text-center py-4">История посещений пуста.</p>
                                )}
                            </div>
                        </div>

                        <hr className="my-6"/>
                        
                        <div className="space-y-4">
                            <h4 className="font-semibold text-gray-600 md:text-lg">Приобретенные абонементы</h4>
                            <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
                                {student.subscriptions && student.subscriptions.length > 0 ? student.subscriptions.map(sub => {
                                    const singleLessonPrice = sub.lessons_total > 0 ? sub.price_paid / sub.lessons_total : 0;
                                    const remainingLessons = sub.lessons_total - sub.lessons_attended;
                                    const remainingValue = singleLessonPrice * remainingLessons;

                                    return (
                                    <div key={sub.id} className="p-3 bg-white rounded shadow-sm border">
                                        <p className="font-bold text-gray-800 md:text-lg">{getPlanName(sub.subscription_plan_id)}</p>
                                        <p className="text-sm md:text-base text-gray-600">
                                            Осталось занятий: <span className="font-semibold text-indigo-600">{remainingLessons}</span> / {sub.lessons_total}
                                        </p>
                                        <p className="text-sm md:text-base text-gray-600">
                                            Денежный остаток: <span className="font-semibold text-gray-800">{remainingValue.toLocaleString(locale, { style: 'currency', currency: 'RUB' })}</span>
                                        </p>
                                        <div className="mt-2 flex items-center space-x-2">
                                            <label className="text-sm font-medium text-gray-700">Использовать для группы:</label>
                                            <select 
                                                value={sub.assigned_group_id || ''}
                                                onChange={(e) => onAssignSubscriptionToGroup(sub.id, e.target.value || null)}
                                                className="w-full p-1 border rounded-md text-sm bg-white text-gray-900"
                                            >
                                                <option value="">Любая группа</option>
                                                {groups.filter(g => student.group_ids?.includes(g.id)).map(g => (
                                                    <option key={g.id} value={g.id}>{g.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {remainingLessons > 0 && (
                                            <button 
                                                onClick={() => setSubToCancel(sub)}
                                                className="w-full text-center mt-3 px-3 py-1 bg-yellow-500 text-white text-sm font-semibold rounded hover:bg-yellow-600 transition"
                                            >
                                                Вернуть остаток и аннулировать
                                            </button>
                                        )}
                                    </div>
                                    )
                                }) : <p className="text-sm text-gray-500 text-center">У ученика нет активных абонементов.</p>}
                            </div>
                        </div>

                        <hr className="my-6"/>

                        <div className="space-y-4">
                            <h4 className="font-semibold text-gray-600 md:text-lg">Оплата нового абонемента</h4>
                            <select value={paymentPlanId || ''} onChange={(e) => setPaymentPlanId(e.target.value)} className={inputStyle}>
                                <option value="">Выберите абонемент для оплаты</option>
                                {subscriptionPlans.filter(p => p.price > 0).map(p => <option key={p.id} value={p.id}>{`${p.name} (${p.price - p.discount}₽)`}</option>)}
                            </select>

                            {paymentPlanId && (
                                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-indigo-600">К оплате: {finalAmount.toLocaleString(locale)} ₽</p>
                                    </div>
                                    <button type="button" onClick={handlePayment} className="w-full mt-2 px-4 py-2 bg-green-600 text-white font-semibold rounded hover:bg-green-700">
                                        Оплатить и добавить абонемент
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        <hr className="my-6"/>

                        <div className="space-y-4">
                            <h4 className="font-semibold text-gray-600 md:text-lg">Опасная зона</h4>
                            <button 
                                type="button"
                                onClick={handleArchive} 
                                className="w-full mt-2 px-4 py-2 bg-red-600 text-white font-semibold rounded hover:bg-red-700">
                                В архив
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Modal>

        {subToCancel && (
            <div 
                className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center"
                onClick={() => setSubToCancel(null)}
            >
                <div 
                    className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
                    onClick={e => e.stopPropagation()}
                >
                    <h3 className="text-xl font-bold text-gray-800">Аннулировать абонемент</h3>
                    <p className="mt-2 text-gray-600">
                        Как вы хотите вернуть остаток средств за абонемент "{getPlanName(subToCancel.subscription_plan_id)}"?
                    </p>
                    <div className="mt-6 flex flex-col space-y-3">
                        <button 
                            onClick={() => {
                                onRefundToBalance(subToCancel.id);
                                setSubToCancel(null);
                            }}
                            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                        >
                            Вернуть на баланс (в кредит)
                        </button>
                        <button 
                            onClick={() => {
                                onCashRefund(subToCancel.id);
                                setSubToCancel(null);
                            }}
                            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                            Вернуть наличными (списание)
                        </button>
                         <button onClick={() => setSubToCancel(null)} className="w-full mt-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Отмена</button>
                    </div>
                </div>
            </div>
        )}
      </>
    );
};