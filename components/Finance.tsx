import React, { useState, useMemo, useEffect } from 'react';
import { FinancialTransaction, Student, Expense, ExpenseForCreation, View } from '../types';
import Modal, { ConfirmationModal } from './Modal';
import { EditIcon, TrashIcon } from './icons';
import { useAppContext } from '../AppContext';

type Period = 'month' | 'year' | 'all';

const StatCard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
    <div className={`p-6 rounded-lg shadow-md ${color}`}>
        <p className="text-white md:text-lg">{label}</p>
        <p className="text-3xl font-bold text-white">{value}</p>
    </div>
);

const expenseCategories = {
  'аренда': 'Аренда',
  'заработная плата': 'Зарплата',
  'приобретение расходников': 'Расходники',
  'иное': 'Иное',
};
type ExpenseCategory = keyof typeof expenseCategories;

const ExpenseForm: React.FC<{
    expense: Partial<Expense> | null;
    onSave: (data: Omit<Expense, 'id'>) => void;
    onCancel: () => void;
}> = ({ expense, onSave, onCancel }) => {
    const [date, setDate] = useState(expense?.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    const [category, setCategory] = useState<ExpenseCategory>('иное');
    const [customDescription, setCustomDescription] = useState('');
    const [amount, setAmount] = useState(expense?.amount || 0);

    useEffect(() => {
        if (expense) {
            setDate(expense.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0]);
            const isPredefined = Object.keys(expenseCategories).includes(expense.description || '');
            setCategory(isPredefined ? expense.description as ExpenseCategory : 'иное');
            setCustomDescription(isPredefined ? '' : expense.description || '');
            setAmount(expense.amount || 0);
        }
    }, [expense]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const description = category === 'иное' ? customDescription.trim() : category;
        if (description && amount > 0 && date) {
            onSave({ date, description, amount });
        }
    };
    
    const inputStyle = "w-full p-2 bg-gray-50 border border-gray-300 rounded-md text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white";

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дата</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputStyle} required />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Категория расхода</label>
                 <select value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)} className={inputStyle}>
                    {Object.entries(expenseCategories).map(([key, value]) => (
                        <option key={key} value={key}>{value}</option>
                    ))}
                </select>
            </div>
            {category === 'иное' && (
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Описание своего варианта</label>
                    <input value={customDescription} onChange={e => setCustomDescription(e.target.value)} className={inputStyle} required />
                </div>
            )}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Сумма (₽)</label>
                <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value) >= 0 ? Number(e.target.value) : 0)} className={inputStyle} required />
            </div>
            <div className="flex justify-end mt-6 space-x-3">
                <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Отмена</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Сохранить</button>
            </div>
        </form>
    );
};


const Finance: React.FC<{ navigateTo: (view: View, studentId?: string) => void }> = ({ navigateTo }) => {
    const { transactions, students, expenses, addExpense, updateExpense, deleteExpense, showNotification } = useAppContext();
    const [period, setPeriod] = useState<Period>('month');
    const [customDates, setCustomDates] = useState<{ start: string, end: string }>({ start: '', end: '' });
    const [activeTab, setActiveTab] = useState<'operations' | 'expenses'>('operations');
    
    const [isExpenseModalOpen, setExpenseModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

    const [newExpense, setNewExpense] = useState({
        date: '',
        category: 'аренда' as ExpenseCategory,
        customDescription: '',
        amount: ''
    });

    const locale = 'ru-RU';
    const studentsMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);

    const { startDate, endDate } = useMemo(() => {
        const now = new Date();
        let start: Date, end: Date;
        if (period === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (period === 'year') {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        } else { // all
            start = new Date(0);
            end = new Date(8640000000000000); // Max Date
        }
        return { startDate: start, endDate: end };
    }, [period]);

    const filteredData = useMemo(() => {
        const filteredTransactions = transactions.filter(t => {
            if (!t || !t.date) return false;
            const tDate = new Date(t.date);
            return !isNaN(tDate.getTime()) && tDate >= startDate && tDate <= endDate;
        });

        const filteredExpenses = expenses.filter(e => {
            if (!e || !e.date) return false;
            const eDate = new Date(e.date);
            return !isNaN(eDate.getTime()) && eDate >= startDate && eDate <= endDate;
        });

        const totalIncome = filteredTransactions
            .reduce((sum, t) => {
                if (t.type === 'payment') {
                    return sum + t.amount;
                }
                if (t.type === 'refund') {
                    return sum - t.amount;
                }
                return sum;
            }, 0);
            
        const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

        return {
            transactions: filteredTransactions,
            expenses: filteredExpenses,
            income: totalIncome,
            expensesTotal: totalExpenses,
            profit: totalIncome - totalExpenses,
        };
    }, [transactions, expenses, startDate, endDate]);

    const handleOpenExpenseModal = (expense: Expense | null = null) => {
        setEditingExpense(expense);
        setExpenseModalOpen(true);
    };

    const handleSaveExpense = async (data: Omit<Expense, 'id'>) => {
        if (editingExpense) {
            await updateExpense(editingExpense.id, data);
            showNotification('Расход обновлен.');
        } 
        setExpenseModalOpen(false);
        setEditingExpense(null);
    };

    const handleAddNewExpense = async () => {
        const amount = parseFloat(newExpense.amount);
        const description = newExpense.category === 'иное' ? newExpense.customDescription.trim() : newExpense.category;

        if (!description || !amount || amount <= 0) {
            showNotification('Заполните описание и сумму расхода.', 'error');
            return;
        }

        await addExpense({
            date: newExpense.date || undefined,
            description,
            amount,
        });

        showNotification('Расход добавлен.');
        setNewExpense({ date: '', category: 'аренда', customDescription: '', amount: '' });
    };
    
    const handleDeleteExpense = async () => {
        if (!expenseToDelete) return;
        await deleteExpense(expenseToDelete.id);
        showNotification('Расход удален.', 'error');
        setExpenseToDelete(null);
    };

    const getTransactionTypeText = (type: FinancialTransaction['type']) => {
        const map = { payment: 'Оплата', refund: 'Возврат', correction: 'Коррекция', debit: 'Списание' };
        return map[type] || 'Прочее';
    }
    const getTransactionStyle = (type: FinancialTransaction['type']) => {
        const map = {
            payment: { badge: 'bg-green-100 text-green-800', text: 'text-green-600', sign: '+' },
            refund: { badge: 'bg-yellow-100 text-yellow-800', text: 'text-red-600', sign: '-' },
            correction: { badge: 'bg-blue-100 text-blue-800', text: 'text-blue-600', sign: '+' },
            debit: { badge: 'bg-red-100 text-red-800', text: 'text-red-600', sign: '-' }
        };
        return map[type] || { badge: 'bg-gray-100 text-gray-800', text: 'text-gray-700', sign: '' };
    }
    
    const PeriodButton: React.FC<{ p: Period; label: string }> = ({ p, label }) => (
        <button
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 text-sm md:text-base rounded-lg transition ${period === p ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
        >{label}</button>
    );

    const TabButton: React.FC<{ t: 'operations' | 'expenses'; label: string }> = ({ t, label }) => (
        <button
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-lg font-semibold border-b-2 ${activeTab === t ? 'text-indigo-600 border-indigo-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
        >{label}</button>
    );
    
    const smallInputStyle = "w-full p-1 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-900 focus:ring-indigo-500 focus:border-indigo-500";


    return (
        <div className="space-y-8">
            <div className="p-4 bg-white rounded-lg shadow-md flex items-center justify-center space-x-2">
                <PeriodButton p="month" label="Этот месяц" />
                <PeriodButton p="year" label="Этот год" />
                <PeriodButton p="all" label="Все время" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Доходы" value={filteredData.income.toLocaleString(locale, { style: 'currency', currency: 'RUB' })} color="bg-green-500" />
                <StatCard label="Расходы" value={filteredData.expensesTotal.toLocaleString(locale, { style: 'currency', currency: 'RUB' })} color="bg-red-500" />
                <StatCard label="Прибыль" value={filteredData.profit.toLocaleString(locale, { style: 'currency', currency: 'RUB' })} color="bg-indigo-500" />
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center border-b mb-4">
                    <div className="flex space-x-4">
                        <TabButton t="operations" label="Операции учеников" />
                        <TabButton t="expenses" label="Расходы" />
                    </div>
                    {activeTab === 'expenses' && (
                         <button onClick={() => handleOpenExpenseModal()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition hidden md:block">Добавить расход</button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    {activeTab === 'operations' ? (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b bg-gray-50">
                                    <th className="p-4 font-semibold text-gray-600">Дата</th>
                                    <th className="p-4 font-semibold text-gray-600">Ученик</th>
                                    <th className="p-4 font-semibold text-gray-600">Тип</th>
                                    <th className="p-4 font-semibold text-gray-600">Описание</th>
                                    <th className="p-4 font-semibold text-gray-600 text-right">Сумма</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.transactions.map(tx => {
                                    const style = getTransactionStyle(tx.type);
                                    const student = studentsMap.get(tx.student_id);
                                    return (
                                        <tr key={tx.id} className="border-b hover:bg-gray-50">
                                            <td className="p-4 whitespace-nowrap text-gray-800">{new Date(tx.date).toLocaleDateString(locale)}</td>
                                            <td className="p-4 font-medium text-gray-900">
                                                <button onClick={() => student && navigateTo('studentFinance', student.id)} className="hover:underline text-indigo-600 disabled:text-gray-900 disabled:no-underline" disabled={!student}>
                                                    {student?.name || 'Н/Д'}
                                                </button>
                                            </td>
                                            <td className="p-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${style.badge}`}>{getTransactionTypeText(tx.type)}</span></td>
                                            <td className="p-4 text-gray-800">{tx.description}</td>
                                            <td className={`p-4 font-bold text-right whitespace-nowrap ${style.text}`}>{style.sign} {tx.amount.toLocaleString(locale)} ₽</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                         <table className="w-full text-left">
                            <thead>
                                <tr className="border-b bg-gray-50">
                                    <th className="p-4 font-semibold text-gray-600">Дата</th>
                                    <th className="p-4 font-semibold text-gray-600">Описание</th>
                                    <th className="p-4 font-semibold text-gray-600 text-right">Сумма</th>
                                    <th className="p-4 font-semibold text-gray-600 text-right">Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.expenses.map(ex => (
                                    <tr key={ex.id} className="border-b hover:bg-gray-50">
                                        <td className="p-4 whitespace-nowrap text-gray-800">{new Date(ex.date).toLocaleDateString(locale)}</td>
                                        <td className="p-4 font-medium text-gray-900">{ex.description}</td>
                                        <td className="p-4 font-bold text-right whitespace-nowrap text-red-600">- {ex.amount.toLocaleString(locale)} ₽</td>
                                        <td className="p-4 text-right">
                                            <button onClick={() => handleOpenExpenseModal(ex)} className="p-2 text-gray-500 hover:text-indigo-600"><EditIcon/></button>
                                            <button onClick={() => setExpenseToDelete(ex)} className="p-2 text-gray-500 hover:text-red-600"><TrashIcon/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-50">
                                    <td className="p-2">
                                        <input type="date" value={newExpense.date} onChange={e => setNewExpense(p => ({...p, date: e.target.value}))} className={smallInputStyle} />
                                    </td>
                                    <td className="p-2 flex gap-2 items-center">
                                         <select value={newExpense.category} onChange={e => setNewExpense(p => ({...p, category: e.target.value as ExpenseCategory}))} className={`${smallInputStyle} flex-1`}>
                                            {Object.entries(expenseCategories).map(([key, value]) => (
                                                <option key={key} value={key}>{value}</option>
                                            ))}
                                        </select>
                                        {newExpense.category === 'иное' && (
                                            <input 
                                                type="text" 
                                                placeholder="Свой вариант..." 
                                                value={newExpense.customDescription} 
                                                onChange={e => setNewExpense(p => ({...p, customDescription: e.target.value}))} 
                                                className={`${smallInputStyle} flex-1`}
                                            />
                                        )}
                                    </td>
                                    <td className="p-2">
                                        <input type="number" placeholder="0" value={newExpense.amount} onChange={e => setNewExpense(p => ({...p, amount: e.target.value}))} className={`${smallInputStyle} text-right`} />
                                    </td>
                                    <td className="p-2 text-right">
                                        <button onClick={handleAddNewExpense} className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-lg shadow hover:bg-indigo-700 transition">Добавить</button>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                     {((activeTab === 'operations' && filteredData.transactions.length === 0) || (activeTab === 'expenses' && filteredData.expenses.length === 0)) && (
                        <div className="text-center p-8 text-gray-500">Нет данных за выбранный период.</div>
                    )}
                </div>
            </div>

            <Modal
                isOpen={isExpenseModalOpen}
                onClose={() => setExpenseModalOpen(false)}
                title={editingExpense ? "Редактировать расход" : "Новый расход"}
            >
                <ExpenseForm
                    expense={editingExpense}
                    onSave={handleSaveExpense}
                    onCancel={() => setExpenseModalOpen(false)}
                />
            </Modal>
            
             <ConfirmationModal
                isOpen={!!expenseToDelete}
                onClose={() => setExpenseToDelete(null)}
                onConfirm={handleDeleteExpense}
                title="Подтверждение удаления"
                message={`Вы уверены, что хотите удалить расход "${expenseToDelete?.description}"?`}
            />
        </div>
    );
};

export default Finance;