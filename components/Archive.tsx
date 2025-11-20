import React, { useState } from 'react';
import { useAppContext } from '../AppContext';
import { ConfirmationModal } from './Modal';

const Archive: React.FC = () => {
    const { students, showNotification, updateStudent, deleteStudents } = useAppContext();
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const locale = 'ru-RU';

    const archivedStudents = students.filter(s => s.status === 'archived');

    const handleSelectStudent = (studentId: string) => {
        setSelectedStudentIds(prev =>
            prev.includes(studentId)
                ? prev.filter(id => id !== studentId)
                : [...prev, studentId]
        );
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedStudentIds(archivedStudents.map(s => s.id));
        } else {
            setSelectedStudentIds([]);
        }
    };

    const handleRestore = async () => {
        if (selectedStudentIds.length === 0) return;
        const updates = selectedStudentIds.map(id => 
            updateStudent(id, { status: 'active', archived_date: null })
        );
        await Promise.all(updates);
        showNotification(`${selectedStudentIds.length} учеников восстановлено.`);
        setSelectedStudentIds([]);
    };

    const handleDeletePermanently = () => {
        if (selectedStudentIds.length > 0) {
            setDeleteModalOpen(true);
        }
    };

    const executeDelete = async () => {
        if (selectedStudentIds.length === 0) return;
        
        const success = await deleteStudents(selectedStudentIds);
        if (success) {
            showNotification(`Удалено ${selectedStudentIds.length} учеников.`, 'error');
            setSelectedStudentIds([]);
        }
    };

    return (
        <div>
            <div className="flex justify-end items-center mb-6">
                <div className="flex space-x-3">
                    <button
                        onClick={handleRestore}
                        disabled={selectedStudentIds.length === 0}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition disabled:bg-gray-400"
                    >
                        Восстановить
                    </button>
                    <button
                        onClick={handleDeletePermanently}
                        disabled={selectedStudentIds.length === 0}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition disabled:bg-gray-400"
                    >
                        Удалить навсегда
                    </button>
                </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b bg-gray-50">
                            <th className="p-4 w-12">
                                <input
                                    type="checkbox"
                                    onChange={handleSelectAll}
                                    checked={selectedStudentIds.length > 0 && selectedStudentIds.length === archivedStudents.length}
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                            </th>
                            <th className="p-4 font-semibold md:text-lg text-gray-600">Имя ученика</th>
                            <th className="p-4 font-semibold md:text-lg text-gray-600">Имя родителя</th>
                            <th className="p-4 font-semibold md:text-lg text-gray-600">Дата архивации</th>
                        </tr>
                    </thead>
                    <tbody>
                        {archivedStudents.map(student => (
                            <tr key={student.id} className="border-b hover:bg-gray-50">
                                <td className="p-4">
                                    <input
                                        type="checkbox"
                                        checked={selectedStudentIds.includes(student.id)}
                                        onChange={() => handleSelectStudent(student.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </td>
                                <td className="p-4 font-medium md:font-bold md:text-lg text-gray-800">{student.name}</td>
                                <td className="p-4 text-gray-600 md:text-base">{student.parent_name}</td>
                                <td className="p-4 text-gray-600 md:text-base">
                                    {student.archived_date ? new Date(student.archived_date).toLocaleDateString(locale) : 'Неизвестно'}
                                </td>
                            </tr>
                        ))}
                        {archivedStudents.length === 0 && (
                            <tr>
                                <td colSpan={4} className="text-center p-8 text-gray-500">
                                    Архив пуст.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={executeDelete}
                title="Подтверждение удаления"
                message={`Вы уверены, что хотите навсегда удалить ${selectedStudentIds.length} учеников? Это действие нельзя отменить.`}
                confirmText="Да, удалить навсегда"
            />
        </div>
    );
};

export default Archive;
