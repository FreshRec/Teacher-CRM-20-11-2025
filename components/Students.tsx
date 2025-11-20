import React, { useState, useMemo, useEffect } from 'react';
import { Student, StudentForCreation } from '../types';
import { ConfirmationModal } from './Modal';
import { StudentEditModal } from './StudentEditModal';
import { useAppContext } from '../AppContext';

const StudentListItem: React.FC<{ student: Student; onEdit: (student: Student) => void }> = ({ student, onEdit }) => {
    const locale = 'ru-RU';
    return (
        <div
            onClick={() => onEdit(student)}
            className="flex items-center p-3 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors duration-150"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onEdit(student)}
        >
            <div className="flex-1 min-w-0">
                <p className="font-bold text-base md:text-lg text-gray-800 truncate">{student.name}</p>
                <p className="text-sm md:text-base text-gray-500 truncate">{student.parent_name} &middot; {student.parent_phone1}</p>
            </div>
            <div className="w-32 text-right">
                <p className={`font-bold text-lg md:text-xl ${student.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {student.balance.toLocaleString(locale)} ₽
                </p>
            </div>
        </div>
    );
};

interface StudentsProps {
    triggerAddStudent: number;
}

const Students: React.FC<StudentsProps> = ({ triggerAddStudent }) => {
    const { 
        students, 
        groups, 
        subscriptionPlans,
        showNotification, 
        addStudent, 
        updateStudent,
        addStudentSubscription,
        updateStudentSubscription,
        refundToBalanceAndCancelSubscription,
        processCashRefundAndCancelSubscription,
    } = useAppContext();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Partial<Student> | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterGroupId, setFilterGroupId] = useState('all');
    const [studentToArchive, setStudentToArchive] = useState<Student | null>(null);

    const activeStudents = useMemo(() => students.filter(s => s.status === 'active'), [students]);

    const filteredAndSortedStudents = useMemo(() => {
        let studentsToDisplay = activeStudents;

        if (filterGroupId && filterGroupId !== 'all') {
            studentsToDisplay = studentsToDisplay.filter(s => s.group_ids?.includes(filterGroupId));
        }

        if (searchQuery) {
            const lowerCaseQuery = searchQuery.toLowerCase();
            studentsToDisplay = studentsToDisplay.filter(s => 
                s.name.toLowerCase().includes(lowerCaseQuery) || 
                s.parent_name.toLowerCase().includes(lowerCaseQuery)
            );
        }
        
        return studentsToDisplay.sort((a, b) => a.name.localeCompare(b.name));
    }, [activeStudents, filterGroupId, searchQuery]);

    const groupedStudentsForDisplay = useMemo(() => {
        const byGroup = new Map<string, Student[]>();
        const unassigned: Student[] = [];
        const groupMap = new Map(groups.map(g => [g.id, g.name]));

        filteredAndSortedStudents.forEach(student => {
            if (!student.group_ids || student.group_ids.length === 0) {
                unassigned.push(student);
            } else {
                student.group_ids.forEach(groupId => {
                     if (byGroup.has(groupId)) {
                        byGroup.get(groupId)!.push(student);
                    } else {
                        byGroup.set(groupId, [student]);
                    }
                });
            }
        });
        
        const sortedGroupEntries = [...byGroup.entries()]
            .sort((a, b) => String(groupMap.get(a[0]) || '').localeCompare(String(groupMap.get(b[0]) || '')));
            
        const finalGroupMap = new Map(sortedGroupEntries);

        return {
            byGroup: finalGroupMap,
            unassigned: (filterGroupId && filterGroupId !== 'all') ? [] : unassigned,
            groupMap,
        };
    }, [filteredAndSortedStudents, groups, filterGroupId]);

    const handleAdd = () => {
        setEditingStudent(null);
        setModalOpen(true);
    };

    useEffect(() => {
        if (triggerAddStudent > 0) {
            handleAdd();
        }
    }, [triggerAddStudent]);

    const handleEdit = (student: Student) => {
        setEditingStudent(student);
        setModalOpen(true);
    };
    
    const handleSave = async (studentData: any) => {
        const isNew = !studentData.id;
        
        let finalStudentData = { ...studentData };
        if (!finalStudentData.birth_date) {
            finalStudentData.birth_date = null;
        }

        if (isNew) {
            delete finalStudentData.id;
            const studentToCreate: StudentForCreation = {
                ...finalStudentData,
                balance: 0,
                status: 'active',
            };
            const result = await addStudent(studentToCreate);
            if(result) showNotification('Ученик добавлен.');
        } else {
            const { id, ...updates } = finalStudentData;
            const result = await updateStudent(id, updates);
            if(result) showNotification('Данные ученика обновлены.');
        }
        setModalOpen(false);
    };

    const handleArchiveStudent = (studentId: string) => {
        const student = students.find(s => s.id === studentId);
        if (student) {
            setModalOpen(false);
            setStudentToArchive(student);
        }
    };

    const executeArchive = async () => {
        if (!studentToArchive) return;
        const result = await updateStudent(studentToArchive.id, {
            status: 'archived',
            archived_date: new Date().toISOString(),
        });
        if (result) {
            showNotification('Ученик перемещен в архив.');
        }
        setStudentToArchive(null);
    };
    
    const handleProcessPayment = async (studentId: string, planId: string, pricePaid: number, lessonsTotal: number) => {
        await addStudentSubscription({
            student_id: studentId,
            subscription_plan_id: planId,
            price_paid: pricePaid,
            lessons_total: lessonsTotal,
            assigned_group_id: null
        });

        // The notification is now handled within addStudentSubscription for better context
        setModalOpen(false);
    };

    const handleAssignSubscriptionToGroup = async (subId: string, groupId: string | null) => {
        await updateStudentSubscription(subId, { assigned_group_id: groupId });
        showNotification('Назначение абонемента обновлено.');
    };
    
    const sortedGroups = useMemo(() => [...groups].sort((a,b) => a.name.localeCompare(b.name)), [groups]);

    return (
        <div>
            <div className="mb-6 p-4 bg-white rounded-lg shadow-md flex flex-col md:flex-row gap-4">
                <input
                    type="text"
                    placeholder="Поиск по имени ученика или родителя..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
                <select
                    value={filterGroupId}
                    onChange={(e) => setFilterGroupId(e.target.value)}
                    className="w-full md:w-64 p-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-indigo-500 focus:border-indigo-500"
                >
                    <option value="all">Все группы</option>
                    {sortedGroups.map(group => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-6">
                {Array.from(groupedStudentsForDisplay.byGroup.entries()).map(([groupId, studentsInGroup]) => (
                     <div key={groupId} className="bg-white rounded-lg shadow-sm">
                        <h3 className="text-lg md:text-xl md:font-bold font-semibold text-indigo-800 bg-indigo-100 p-3 rounded-t-lg">
                           {groupedStudentsForDisplay.groupMap.get(groupId) || 'Неизвестная группа'}
                        </h3>
                        <div className="space-y-1 p-2">
                            {studentsInGroup.map(student => (
                                <StudentListItem key={`${student.id}-${groupId}`} student={student} onEdit={handleEdit} />
                            ))}
                        </div>
                    </div>
                ))}
                
                {groupedStudentsForDisplay.unassigned.length > 0 && (
                     <div className="bg-white rounded-lg shadow-sm">
                        <h3 className="text-lg md:text-xl md:font-bold font-semibold text-gray-800 bg-gray-100 p-3 rounded-t-lg">Без группы</h3>
                        <div className="space-y-1 p-2">
                           {groupedStudentsForDisplay.unassigned.map(student => (
                                <StudentListItem key={student.id} student={student} onEdit={handleEdit} />
                            ))}
                        </div>
                    </div>
                )}
                
                {filteredAndSortedStudents.length === 0 && (
                     <div className="text-center py-10 px-6 bg-white rounded-lg shadow-md">
                        <p className="text-gray-500">Ученики не найдены.</p>
                        <p className="text-gray-500 mt-2">Попробуйте изменить фильтры или добавить нового ученика.</p>
                    </div>
                )}
            </div>

            <StudentEditModal 
                isOpen={isModalOpen}
                onClose={() => setModalOpen(false)}
                student={editingStudent}
                onSave={handleSave}
                onArchive={handleArchiveStudent}
                onProcessPayment={handleProcessPayment}
                onRefundToBalance={refundToBalanceAndCancelSubscription}
                onCashRefund={processCashRefundAndCancelSubscription}
                onAssignSubscriptionToGroup={handleAssignSubscriptionToGroup}
                groups={groups}
                subscriptionPlans={subscriptionPlans}
            />

            <ConfirmationModal
                isOpen={!!studentToArchive}
                onClose={() => setStudentToArchive(null)}
                onConfirm={executeArchive}
                title="Подтверждение архивации"
                message={`Вы уверены, что хотите архивировать ученика ${studentToArchive?.name}? Его можно будет восстановить позже.`}
                confirmText="Да, в архив"
            />
        </div>
    );
};

export default Students;
