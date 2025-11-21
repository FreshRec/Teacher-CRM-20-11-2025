import React, { useState, useEffect } from 'react';
import { SubscriptionPlan, SubscriptionPlanForCreation } from '../types';
import Modal from './Modal';
import { useAppContext } from '../AppContext';
import { SYSTEM_SUBSCRIPTION_PLAN_ID } from '../constants';

const StarIcon: React.FC<{ isFilled: boolean } & React.SVGProps<SVGSVGElement>> = ({ isFilled, ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" {...props}>
        <path 
            fill={isFilled ? "currentColor" : "none"} 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" 
        />
    </svg>
);


const SubscriptionPlanForm: React.FC<{ 
    plan: Partial<SubscriptionPlan> | null; 
    onSave: (plan: SubscriptionPlan) => void; 
    onCancel: () => void 
}> = ({ plan, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        name: plan?.name || '',
        price: plan?.price || 0,
        discount: plan?.discount || 0,
        lesson_count: plan?.lesson_count || 8,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: Number(value) >= 0 ? Number(value) : prev[name as keyof typeof prev] }));
    };
    
     const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newPlan: SubscriptionPlan = {
            id: plan?.id || `new-plan-${Date.now()}`, // Temporary ID for new plans
            ...formData,
        };
        onSave(newPlan);
    };

    const inputStyle = "w-full p-2 bg-gray-50 border border-gray-300 rounded-md text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white";

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="plan-name" className="block text-sm font-medium text-gray-700 mb-1">Название абонемента</label>
                <input id="plan-name" name="name" value={formData.name} onChange={handleTextChange} className={inputStyle} required />
            </div>
            <div>
                <label htmlFor="plan-price" className="block text-sm font-medium text-gray-700 mb-1">Стоимость (₽)</label>
                <input id="plan-price" type="number" name="price" value={formData.price} onChange={handleChange} className={inputStyle} required />
            </div>
            <div>
                <label htmlFor="plan-discount" className="block text-sm font-medium text-gray-700 mb-1">Скидка (₽)</label>
                <input id="plan-discount" type="number" name="discount" value={formData.discount} onChange={handleChange} className={inputStyle} />
            </div>
            <div>
                <label htmlFor="plan-lessonCount" className="block text-sm font-medium text-gray-700 mb-1">Количество занятий</label>
                <input id="plan-lessonCount" type="number" name="lesson_count" value={formData.lesson_count} onChange={handleChange} className={inputStyle} required min="1"/>
            </div>

             <div className="flex justify-end mt-6 space-x-3">
                <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Отмена</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Сохранить</button>
            </div>
        </form>
    );
};


const Subscriptions: React.FC<{ triggerAddSubscription: number }> = ({ triggerAddSubscription }) => {
    const { subscriptionPlans, showNotification, addSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan } = useAppContext();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Partial<SubscriptionPlan> | null>(null);

     const handleAdd = () => {
        setEditingPlan(null);
        setModalOpen(true);
    };

    useEffect(() => {
        if (triggerAddSubscription > 0) {
            handleAdd();
        }
    }, [triggerAddSubscription]);

    const handleEdit = (plan: SubscriptionPlan) => {
        setEditingPlan(plan);
        setModalOpen(true);
    };

    const handleDelete = async (planId: string) => {
         if (window.confirm("Вы уверены, что хотите удалить этот абонемент?")) {
            await deleteSubscriptionPlan(planId);
            showNotification('Абонемент удален.', 'error');
        }
    }

    const handleSave = async (planDataFromForm: SubscriptionPlan) => {
        if (editingPlan) { // It's an update
            const updates = {
                name: planDataFromForm.name,
                price: planDataFromForm.price,
                discount: planDataFromForm.discount,
                lesson_count: planDataFromForm.lesson_count,
            };
            const result = await updateSubscriptionPlan(editingPlan.id!, updates);
            if (result) showNotification('Абонемент обновлен.');
        } else { // It's a new plan
            const planForCreation: SubscriptionPlanForCreation = {
                name: planDataFromForm.name,
                price: planDataFromForm.price,
                discount: planDataFromForm.discount,
                lesson_count: planDataFromForm.lesson_count,
            };
            const result = await addSubscriptionPlan(planForCreation);
            if (result) showNotification('Абонемент добавлен.');
        }
        setModalOpen(false);
        setEditingPlan(null);
    };

    const handleSetDefault = async (planId: string) => {
        await updateSubscriptionPlan(planId, { is_default: true });
        showNotification('Абонемент по умолчанию обновлен.');
    };
    
    const locale = 'ru-RU';

    return (
        <div>
            <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b bg-gray-50">
                            <th className="p-4 font-semibold md:text-lg text-gray-600 w-16 text-center">По умолч.</th>
                            <th className="p-4 font-semibold md:text-lg text-gray-600">Название</th>
                            <th className="p-4 font-semibold md:text-lg text-gray-600">Полная стоимость</th>
                            <th className="p-4 font-semibold md:text-lg text-gray-600">Кол-во занятий</th>
                             <th className="p-4 font-semibold md:text-lg text-gray-600">Цена 1 занятия</th>
                            <th className="p-4 font-semibold md:text-lg text-gray-600">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {subscriptionPlans.map(plan => {
                            const isSystemPlan = plan.id === SYSTEM_SUBSCRIPTION_PLAN_ID;
                            const finalPrice = plan.price - plan.discount;
                            const lessonPrice = plan.lesson_count > 0 ? finalPrice / plan.lesson_count : 0;
                            return (
                             <tr key={plan.id} className={`border-b ${isSystemPlan ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                                <td className="p-4 text-center">
                                    <button 
                                        onClick={() => handleSetDefault(plan.id)} 
                                        disabled={isSystemPlan}
                                        className={`cursor-pointer ${plan.is_default ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'} ${isSystemPlan ? 'cursor-not-allowed text-gray-300' : ''}`}
                                        title={isSystemPlan ? "Системный абонемент нельзя сделать стандартным" : "Сделать абонементом по умолчанию"}
                                    >
                                        <StarIcon isFilled={!!plan.is_default} />
                                    </button>
                                </td>
                                <td className="p-4 font-medium md:font-bold md:text-lg text-gray-900">
                                    {plan.name}
                                    {isSystemPlan && <span className="ml-2 text-xs text-gray-500">(системный)</span>}
                                </td>
                                <td className="p-4 text-gray-800 md:text-base">{finalPrice.toLocaleString(locale)} ₽ {plan.discount > 0 && <span className="text-sm text-gray-500 line-through ml-1">{plan.price.toLocaleString(locale)} ₽</span>}</td>
                                <td className="p-4 text-gray-800 md:text-base">{plan.lesson_count > 0 ? plan.lesson_count : '-'}</td>
                                <td className="p-4 text-gray-800 md:text-base">{lessonPrice > 0 ? `${lessonPrice.toFixed(2)} ₽` : '-'}</td>
                                <td className="p-4 space-x-2">
                                    {!isSystemPlan && (
                                        <>
                                            <button onClick={() => handleEdit(plan)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Редактировать</button>
                                            <button onClick={() => handleDelete(plan.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Удалить</button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editingPlan?.id ? "Редактировать абонемент" : "Новый абонемент"}>
                 <SubscriptionPlanForm
                    plan={editingPlan}
                    onSave={handleSave}
                    onCancel={() => setModalOpen(false)}
                />
            </Modal>
        </div>
    );
};

export default Subscriptions;
