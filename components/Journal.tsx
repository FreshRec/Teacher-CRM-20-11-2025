
import React, { useState, useMemo, useRef } from 'react';
import { useAppContext } from '../AppContext';
import { Student, Attendance, StudentForCreation } from '../types';
import { StudentEditModal } from './StudentEditModal';
import Modal, { ConfirmationModal } from './Modal';

const JournalCell: React.FC<{
    student: Student;
    date: Date;
    record: Attendance | undefined;
    selectedGroupId: string;
}> = React.memo(({ student, date, record, selectedGroupId }) => {
    const context = useAppContext();
    const longPressTimer = useRef<number | null>(null);
    const touchStartRef = useRef<{ x: number, y: number } | null>(null);
    const [isGradeModalOpen, setGradeModalOpen] = useState(false);

    const handleAttendanceCycle = async () => {
        const dateStr = date.toISOString().split('T')[0];
        const currentStatus = record?.status;
        let nextStatus: 'present' | 'absent' | 'excused' | undefined = undefined;

        if (!currentStatus) {
            nextStatus = 'present';
        } else if (currentStatus === 'present') {
            nextStatus = 'absent';
        } else if (currentStatus === 'absent') {
            nextStatus = 'excused';
        } else if (currentStatus === 'excused') {
            await context.deleteAttendanceRecord(student.id, dateStr);
            return;
        }

        if (nextStatus) {
            await context.setAttendanceRecord({
                student_id: student.id,
                date: dateStr,
                status: nextStatus,
                // Keep grade only if present, otherwise clear it (pass null)
                grade: nextStatus === 'present' ? record?.grade : null,
            }, selectedGroupId);
        }
    };
    
    const handleSetGrade = async (grade?: number) => {
        const dateStr = date.toISOString().split('T')[0];
        await context.setAttendanceRecord({
            student_id: student.id,
            date: dateStr,
            status: 'present', 
            grade: grade ?? null // Pass null if undefined to clear the grade
        }, selectedGroupId);
        setGradeModalOpen(false);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        touchStartRef.current = { x: e.clientX, y: e.clientY };
        longPressTimer.current = window.setTimeout(() => {
            setGradeModalOpen(true);
            longPressTimer.current = null;
            touchStartRef.current = null;
        }, 500);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!touchStartRef.current) return;
        const deltaX = Math.abs(e.clientX - touchStartRef.current.x);
        const deltaY = Math.abs(e.clientY - touchStartRef.current.y);
        if (deltaX > 10 || deltaY > 10) {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
            touchStartRef.current = null;
        }
    };

    const handlePointerUp = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
            handleAttendanceCycle();
        }
        touchStartRef.current = null;
    };
    
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        touchStartRef.current = null;
        setGradeModalOpen(true);
    };
    
    const handlePointerLeave = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        touchStartRef.current = null;
    };


    const statusMap = {
        present: { text: 'Б', style: 'bg-green-200 text-green-800' },
        absent: { text: 'Н', style: 'bg-red-200 text-red-800' },
        excused: { text: 'У', style: 'bg-yellow-200 text-yellow-800' },
    };
    
    const gradeStyleMap: { [key: number]: string } = {
        5: 'bg-green-500 text-white',
        4: 'bg-lime-400 text-lime-900',
        3: 'bg-yellow-400 text-yellow-900',
        2: 'bg-red-500 text-white',
    };
    
    const cellStyle = record?.grade 
        ? gradeStyleMap[record.grade] || 'bg-gray-200 text-gray-800'
        : (record ? statusMap[record.status].style : 'bg-transparent');
        
    const displayContent = record?.grade ? record.grade.toString() : (record ? statusMap[record.status].text : '');


    return (
        <>
            <td
                className={`border border-gray-400 text-center cursor-pointer transition-colors select-none p-0 h-14`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                onContextMenu={handleContextMenu}
            >
                <div className={`w-full h-full flex items-center justify-center text-lg md:text-xl font-semibold ${cellStyle}`}>
                    <span>{displayContent}</span>
                </div>
            </td>
            {isGradeModalOpen && (
                 <Modal isOpen={isGradeModalOpen} onClose={() => setGradeModalOpen(false)} title={`Оценка для ${student.name}`}>
                    <div className="flex flex-col space-y-2">
                        <p className="text-center text-gray-600 md:text-lg">Дата: {date.toLocaleDateString('ru-RU')}</p>
                        <div className="grid grid-cols-2 gap-2 pt-2">
                            {[5, 4, 3, 2].map(grade => (
                                <button key={grade} onClick={() => handleSetGrade(grade)} className="p-3 text-lg bg-indigo-500 text-white rounded-md hover:bg-indigo-600 md:text-xl">
                                    Поставить «{grade}»
                                </button>
                            ))}
                        </div>
                        <button onClick={() => handleSetGrade(undefined)} className="p-2 mt-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 md:text-lg">
                            Убрать оценку
                        </button>
                    </div>
                </Modal>
            )}
        </>
    );
});


interface JournalProps {
    currentDate: Date;
    selectedGroupId: string;
    isDesktop: boolean;
}

const Journal: React.FC<JournalProps> = ({ currentDate, selectedGroupId, isDesktop }) => {
    const context = useAppContext();
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [isStudentModalOpen, setStudentModalOpen] = useState(false);
    const [studentToArchive, setStudentToArchive] = useState<Student | null>(null);
    
    const [addStudentQuery, setAddStudentQuery] = useState('');
    const [isAutocompleteOpen, setAutocompleteOpen] = useState(false);
    
    const locale = 'ru-RU';
    
    const weekDays = useMemo(() => {
        const startOfWeek = new Date(currentDate);
        startOfWeek.setHours(0, 0, 0, 0);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // week starts on Monday
        startOfWeek.setDate(diff);
        return Array.from({ length: 7 }, (_, i) => {
            const newDay = new Date(startOfWeek);
            newDay.setDate(startOfWeek.getDate() + i);
            return newDay;
        });
    }, [currentDate]);
    
    const monthDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const date = new Date(year, month, 1);
        const days = [];
        while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    }, [currentDate]);

    const daysToDisplay = isDesktop ? monthDays : weekDays;

    const studentsInGroup = useMemo(() => {
        if (!selectedGroupId) return [];
        
        return context.students
            .filter(s => s.status === 'active' && s.group_ids?.includes(selectedGroupId))
            .sort((a, b) => a.name.localeCompare(b.name));

    }, [context.students, selectedGroupId]);

    const displayedAttendance = useMemo(() => {
        const displayedDateStrings = new Set(daysToDisplay.map(d => d.toISOString().split('T')[0]));
        const records = new Map<string, Attendance>();
        context.attendance.forEach(a => {
            if (displayedDateStrings.has(a.date)) {
                 records.set(`${a.student_id}-${a.date}`, a);
            }
        });
        return records;
    }, [context.attendance, daysToDisplay]);

    const handleOpenStudentModal = (student: Student) => {
        setEditingStudent(student);
        setStudentModalOpen(true);
    };

    const handleSaveStudent = async (studentData: Partial<Student>) => {
        if (!studentData.id) return;
        
        const finalStudentData = { ...studentData };
        if (!finalStudentData.birth_date) {
            finalStudentData.birth_date = null;
        }

        const { id, ...updates } = finalStudentData;
        if (id) {
            const result = await context.updateStudent(id, updates);
            if(result) context.showNotification('Данные ученика обновлены.');
        }
        setStudentModalOpen(false);
    };
    
    const handleArchiveStudent = (studentId: string) => {
        const student = context.students.find(s => s.id === studentId);
        if (student) {
            setStudentModalOpen(false);
            setStudentToArchive(student);
        }
    };
    
    const executeArchive = async () => {
        if (!studentToArchive) return;
        const result = await context.updateStudent(studentToArchive.id, {
            status: 'archived',
            archived_date: new Date().toISOString(),
        });
        if (result) context.showNotification('Ученик перемещен в архив.');
        setStudentToArchive(null);
    };

    const handleProcessPayment = async (studentId: string, planId: string, pricePaid: number, lessonsTotal: number) => {
        await context.addStudentSubscription({
            student_id: studentId,
            subscription_plan_id: planId,
            price_paid: pricePaid,
            lessons_total: lessonsTotal,
            assigned_group_id: null,
        });
        setStudentModalOpen(false);
    };

    const handleAssignSubscriptionToGroup = async (subId: string, groupId: string | null) => {
        await context.updateStudentSubscription(subId, { assigned_group_id: groupId });
        context.showNotification('Назначение абонемента обновлено.');
    };

    const studentFinancials = useMemo(() => {
        const financials = new Map<string, { lessons: string, balance: string }>();
        studentsInGroup.forEach(student => {
            const activeSubs = student.subscriptions?.filter(s => s.lessons_attended < s.lessons_total) || [];
            let totalLessons = 0;
            let attendedLessons = 0;
            let remainingValue = 0;

            activeSubs.forEach(sub => {
                totalLessons += sub.lessons_total;
                attendedLessons += sub.lessons_attended;
                const lessonPrice = sub.lessons_total > 0 ? sub.price_paid / sub.lessons_total : 0;
                remainingValue += (sub.lessons_total - sub.lessons_attended) * lessonPrice;
            });
            
            const debtLessons = context.attendance.filter(a => 
                a.student_id === student.id && 
                !a.student_subscription_id && 
                (a.status === 'present' || a.status === 'absent')
            ).length;
            
            financials.set(student.id, {
                lessons: `${totalLessons - attendedLessons - debtLessons}`,
                balance: `${(remainingValue + student.balance).toLocaleString(locale)} ₽`
            });
        });
        return financials;
    }, [studentsInGroup, locale, context.attendance]);
    
    const handleAddNewStudents = async (names: string[]) => {
        if (names.length === 0 || !selectedGroupId) return;
        
        const studentsToCreate: StudentForCreation[] = names.map(name => ({
            name,
            parent_name: 'Не указано', parent_phone1: 'Не указано', birth_date: null,
            balance: 0, status: 'active', group_ids: [selectedGroupId],
        }));

        const result = await context.addStudents(studentsToCreate);
        if (result) {
            context.showNotification(`Добавлено учеников: ${result.length}.`, 'success');
            setAddStudentQuery('');
        }
    };
    
    const handleAddExistingStudent = async (student: Student) => {
        if (!selectedGroupId) return;
        const newGroupIds = [...(student.group_ids || []), selectedGroupId];
        await context.updateStudent(student.id, { group_ids: newGroupIds });
        setAddStudentQuery('');
        setAutocompleteOpen(false);
        context.showNotification(`${student.name} добавлен в группу.`);
    };

    const availableStudentsToAdd = useMemo(() => {
        if (!addStudentQuery.trim() || !selectedGroupId) return [];
        const lowerCaseQuery = addStudentQuery.toLowerCase();
        return context.students.filter(s =>
            s.status === 'active' &&
            !s.group_ids?.includes(selectedGroupId) &&
            s.name.toLowerCase().includes(lowerCaseQuery)
        ).slice(0, 10);
    }, [addStudentQuery, context.students, selectedGroupId]);

    const handleAddStudentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const name = addStudentQuery.trim();
            // Create new student only if there are no suggestions
            if (name && availableStudentsToAdd.length === 0) {
                 handleAddNewStudents([name]);
            }
        }
    };

    const handleAddStudentPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pastedText = e.clipboardData.getData('text');
        const names = pastedText.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
        if (names.length > 1) {
            e.preventDefault();
            handleAddNewStudents(names);
        }
    };
    
    const addStudentColSpan = daysToDisplay.length + 4;

    return (
        <div className="relative">
            {context.isSaving && (
                <div className="fixed inset-0 bg-white bg-opacity-70 z-50 flex flex-col justify-center items-center">
                    <svg className="animate-spin h-8 w-8 text-indigo-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-indigo-600 font-semibold">Сохранение...</span>
                </div>
            )}
            
            <div className="bg-white rounded-lg shadow-md border border-gray-400 md:overflow-x-auto">
                <table className="w-full border-collapse md:min-w-full">
                    <thead className="md:sticky md:top-0 z-30 bg-white">
                        <tr>
                            <th className="md:sticky md:left-0 z-40 border border-gray-400 p-1 bg-white align-middle text-sm md:text-base font-bold text-gray-600 text-center w-10">№</th>
                            <th className="md:sticky md:left-10 z-40 border border-gray-400 bg-white align-middle p-2 text-sm md:text-base font-bold text-gray-600 text-left w-1/4 md:w-48 md:shadow-[inset_-1px_0_0_0_#9ca3af]">Ученик</th>
                            {daysToDisplay.map(day => (
                                <th key={day.toISOString()} className="p-1 text-sm md:text-base font-bold text-gray-600 text-center border border-gray-400 bg-white w-14">
                                    <div className="md:hidden">{day.toLocaleDateString(locale, { weekday: 'short' })}</div>
                                    <div className="hidden md:block">{day.getDate()}</div>
                                </th>
                            ))}
                            <th className="p-1 text-sm md:text-base font-bold text-gray-600 text-center border border-gray-400 bg-white align-middle whitespace-normal w-28">Остаток (зан.)</th>
                            <th className="p-1 text-sm md:text-base font-bold text-gray-600 text-center border border-gray-400 bg-white align-middle whitespace-normal w-32">Остаток (₽)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {studentsInGroup.map((student, index) => (
                            <tr key={student.id} className="group/row">
                                 <td className="md:sticky md:left-0 z-20 border border-gray-400 text-center text-base md:text-lg font-bold text-gray-500 bg-white group-hover/row:bg-indigo-50 p-1">
                                    {index + 1}
                                </td>
                                <td className="md:sticky md:left-10 z-20 border border-gray-400 bg-white group-hover/row:bg-indigo-50 p-2 font-bold text-base md:text-lg text-gray-800 whitespace-normal md:whitespace-nowrap cursor-pointer md:shadow-[inset_-1px_0_0_0_#9ca3af]" onClick={() => handleOpenStudentModal(student)}>
                                    {student.name}
                                </td>
                                {daysToDisplay.map(day => {
                                    const dateKey = day.toISOString().split('T')[0];
                                    const record = displayedAttendance.get(`${student.id}-${dateKey}`);
                                    return <JournalCell
                                        key={day.toISOString()}
                                        student={student}
                                        date={day}
                                        record={record}
                                        selectedGroupId={selectedGroupId}
                                    />
                                })}
                                <td className="p-2 text-center border border-gray-400 text-base md:text-lg font-bold text-gray-700 bg-white group-hover/row:bg-indigo-50">{studentFinancials.get(student.id)?.lessons || 'N/A'}</td>
                                <td className="p-2 text-center border border-gray-400 text-base md:text-lg font-bold text-gray-700 bg-white group-hover/row:bg-indigo-50">{studentFinancials.get(student.id)?.balance || 'N/A'}</td>
                            </tr>
                        ))}
                         <tr className="bg-gray-50 h-12">
                             <td colSpan={addStudentColSpan} className="p-2 border-t border-gray-400 align-middle relative">
                                <input
                                    type="text" value={addStudentQuery}
                                    onChange={(e) => setAddStudentQuery(e.target.value)}
                                    onKeyDown={handleAddStudentKeyDown}
                                    onPaste={handleAddStudentPaste}
                                    onFocus={() => setAutocompleteOpen(true)}
                                    onBlur={() => setTimeout(() => setAutocompleteOpen(false), 150)}
                                    placeholder="Добавить или найти ученика..."
                                    className="w-full p-2 border rounded-md"
                                />
                                {isAutocompleteOpen && addStudentQuery && (
                                    <div className="absolute bottom-full left-0 right-0 z-30 w-full bg-white border rounded-md mb-1 shadow-lg max-h-48 overflow-y-auto">
                                        {availableStudentsToAdd.length > 0 ? (
                                            availableStudentsToAdd.map(student => (
                                                <div
                                                    key={student.id}
                                                    onMouseDown={() => handleAddExistingStudent(student)}
                                                    className="p-2 text-gray-800 hover:bg-indigo-100 cursor-pointer"
                                                >
                                                    {student.name}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-2 text-gray-700 italic">
                                                Ученик не найден. Нажмите Enter, чтобы создать нового.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </td>
                         </tr>
                    </tbody>
                </table>
                {studentsInGroup.length === 0 && (
                    <div className="text-center p-8 text-gray-500">
                        {selectedGroupId ? 'В этой группе нет активных учеников.' : 'Выберите группу для отображения журнала.'}
                    </div>
                )}
            </div>

            {editingStudent && <StudentEditModal
                isOpen={isStudentModalOpen}
                onClose={() => setStudentModalOpen(false)}
                student={editingStudent}
                onSave={handleSaveStudent}
                onArchive={handleArchiveStudent}
                onProcessPayment={handleProcessPayment}
                onRefundToBalance={context.refundToBalanceAndCancelSubscription}
                onCashRefund={context.processCashRefundAndCancelSubscription}
                onAssignSubscriptionToGroup={handleAssignSubscriptionToGroup}
                groups={context.groups}
                subscriptionPlans={context.subscriptionPlans}
            />}

            <ConfirmationModal
                isOpen={!!studentToArchive}
                onClose={() => setStudentToArchive(null)}
                onConfirm={executeArchive}
                title="Подтверждение архивации"
                message={`Вы уверены, что хотите архивировать ученика ${studentToArchive?.name}?`}
                confirmText="Да, в архив"
            />
        </div>
    );
};

export default Journal;
