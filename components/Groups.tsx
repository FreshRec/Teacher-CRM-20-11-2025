import React, { useState, useMemo, useEffect } from 'react';
import { Group, Student, GroupForCreation } from '../types';
import Modal, { ConfirmationModal } from './Modal';
import { TrashIcon } from './icons';
import { useAppContext } from '../AppContext';

const GroupForm: React.FC<{
    group: Partial<Group> | null;
    onSave: (groupData: GroupForCreation) => void;
    onCancel: () => void;
}> = ({ group, onSave, onCancel }) => {
    const [name, setName] = useState(group?.name || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ name });
    };
    
    const inputStyle = "w-full p-2 bg-gray-50 border border-gray-300 rounded-md text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white";

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Название группы" className={inputStyle} required autoFocus/>
            <div className="flex justify-end mt-6 space-x-3">
                <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Отмена</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Сохранить</button>
            </div>
        </form>
    );
};

const XIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);


const Groups: React.FC<{ triggerAddGroup: number }> = ({ triggerAddGroup }) => {
    const { groups, students, addGroup, updateGroup, updateStudent, deleteGroup, showNotification } = useAppContext();
    const [isModalOpen, setModalOpen] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
    
    // States for in-place editing
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editingGroupName, setEditingGroupName] = useState('');
    
    // States for adding students
    const [addStudentQuery, setAddStudentQuery] = useState<{ [groupId: string]: string }>({});
    const [activeAutocomplete, setActiveAutocomplete] = useState<string | null>(null);

    const activeStudents = useMemo(() => students.filter(s => s.status === 'active'), [students]);

    const UNASSIGNED_GROUP_ID = 'unassigned_students_group';
    const unassignedGroup: Group = { id: UNASSIGNED_GROUP_ID, name: 'Без группы' };
    
    const allGroupsForDisplay = useMemo(() => {
        const sortedGroups = [...groups].sort((a,b) => a.name.localeCompare(b.name));
        return [...sortedGroups, unassignedGroup];
    }, [groups]);

    const studentsByGroup = useMemo(() => {
        const map = new Map<string, Student[]>();
        allGroupsForDisplay.forEach(group => map.set(group.id, []));
        
        activeStudents.forEach(student => {
            if (student.group_ids && student.group_ids.length > 0) {
                student.group_ids.forEach(groupId => {
                    if (map.has(groupId)) {
                        map.get(groupId)!.push(student);
                    }
                });
            } else {
                map.get(UNASSIGNED_GROUP_ID)!.push(student);
            }
        });

        for (const studentList of map.values()) {
            studentList.sort((a, b) => a.name.localeCompare(b.name));
        }
        return map;
    }, [activeStudents, allGroupsForDisplay]);

    const handleAdd = () => {
        setModalOpen(true);
    };

    useEffect(() => {
        if (triggerAddGroup > 0) {
            handleAdd();
        }
    }, [triggerAddGroup]);

    const handleDelete = (group: Group) => {
        setGroupToDelete(group);
    };
    
    const executeDelete = async () => {
        if (!groupToDelete) return;
        
        const studentsInDeletedGroup = students.filter(s => s.group_ids?.includes(groupToDelete.id));
        
        const studentUpdates = studentsInDeletedGroup.map(s => {
            const newGroupIds = s.group_ids?.filter(id => id !== groupToDelete.id) || [];
            return updateStudent(s.id, { group_ids: newGroupIds });
        });
        
        await Promise.all(studentUpdates);

        const deleted = await deleteGroup(groupToDelete.id);

        if (deleted) {
            showNotification(`Группа "${groupToDelete.name}" удалена, ученики откреплены.`, 'error');
        }
        
        setGroupToDelete(null);
    };

    const handleCreate = async (groupData: GroupForCreation) => {
        const result = await addGroup(groupData);
        if(result) showNotification('Группа создана.');
        setModalOpen(false);
    };
    
    const handleStartEdit = (group: Group) => {
        setEditingGroupId(group.id);
        setEditingGroupName(group.name);
    };

    const handleCancelEdit = () => {
        setEditingGroupId(null);
        setEditingGroupName('');
    };

    const handleFinishEdit = async () => {
        if (!editingGroupId) return;

        const trimmedName = editingGroupName.trim();
        const originalGroup = groups.find(g => g.id === editingGroupId);

        if (!trimmedName) {
            handleCancelEdit();
            return;
        }

        if (originalGroup && originalGroup.name !== trimmedName) {
            await updateGroup(editingGroupId, { name: trimmedName });
            showNotification('Название группы обновлено.');
        }
        
        handleCancelEdit();
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleFinishEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelEdit();
        }
    };
    
    const handleQueryChange = (groupId: string, query: string) => {
        setAddStudentQuery(prev => ({ ...prev, [groupId]: query }));
        if (query) {
            setActiveAutocomplete(groupId);
        } else {
            setActiveAutocomplete(null);
        }
    };

    const handleAddStudentToGroup = async (student: Student, groupId: string) => {
        const newGroupIds = [...(student.group_ids || []), groupId];
        await updateStudent(student.id, { group_ids: newGroupIds });
        setAddStudentQuery(prev => ({ ...prev, [groupId]: '' }));
        setActiveAutocomplete(null);
        showNotification(`${student.name} добавлен в группу.`);
    };

    const handleRemoveStudentFromGroup = async (student: Student, groupId: string) => {
        const newGroupIds = (student.group_ids || []).filter(id => id !== groupId);
        await updateStudent(student.id, { group_ids: newGroupIds });
        showNotification(`${student.name} удален из группы.`);
    };
    
    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allGroupsForDisplay.map(group => {
                    const isUnassignedGroup = group.id === UNASSIGNED_GROUP_ID;
                    const groupStudents = studentsByGroup.get(group.id) || [];
                    
                    if (isUnassignedGroup && groupStudents.length === 0) {
                        return null;
                    }

                    const isEditing = editingGroupId === group.id;
                    const currentQuery = addStudentQuery[group.id] || '';
                    const availableStudents = currentQuery ? activeStudents.filter(s => 
                        !s.group_ids?.includes(group.id) && s.name.toLowerCase().includes(currentQuery.toLowerCase())
                    ).slice(0, 10) : [];

                    return (
                        <div key={group.id} className="bg-white p-5 rounded-lg shadow-md flex flex-col">
                            <div>
                                <div className="flex justify-between items-start">
                                     {isEditing && !isUnassignedGroup ? (
                                        <input
                                            type="text"
                                            value={editingGroupName}
                                            onChange={(e) => setEditingGroupName(e.target.value)}
                                            onBlur={handleFinishEdit}
                                            onKeyDown={handleInputKeyDown}
                                            className="text-xl md:text-2xl font-bold text-gray-800 mb-3 bg-white border border-indigo-500 rounded px-1 w-full mr-2"
                                            autoFocus
                                        />
                                    ) : (
                                        <h3 
                                            className={`text-xl md:text-2xl font-bold text-gray-800 mb-3 flex-grow ${!isUnassignedGroup ? 'cursor-pointer hover:bg-gray-100 rounded px-1' : ''}`}
                                            onClick={() => !isUnassignedGroup && handleStartEdit(group)}
                                        >
                                            {group.name}
                                        </h3>
                                    )}
                                    {!isUnassignedGroup && (
                                        <div className="flex-shrink-0">
                                            <button onClick={() => handleDelete(group)} className="text-gray-400 hover:text-red-600 p-1 rounded-full transition-colors">
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="space-y-2 text-sm">
                                    <h4 className="font-semibold text-gray-600 md:text-lg">Ученики ({groupStudents.length}):</h4>
                                    {groupStudents.length > 0 ? (
                                        <ul className="space-y-1">
                                            {groupStudents.map(s => (
                                                <li key={s.id} className="flex justify-between items-center group text-gray-700 hover:bg-gray-100 p-1 rounded md:text-lg">
                                                    <span>{s.name}</span>
                                                    {!isUnassignedGroup && (
                                                        <button onClick={() => handleRemoveStudentFromGroup(s, group.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <XIcon />
                                                        </button>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-gray-500 italic">
                                            {isUnassignedGroup ? 'Все ученики распределены по группам.' : 'В группе нет учеников.'}
                                        </p>
                                    )}
                                </div>
                            </div>
                            {!isUnassignedGroup && (
                                <div className="mt-auto pt-4 relative">
                                    <input
                                        type="text"
                                        placeholder="Добавить ученика..."
                                        value={currentQuery}
                                        onChange={(e) => handleQueryChange(group.id, e.target.value)}
                                        onFocus={() => handleQueryChange(group.id, currentQuery)} // Re-trigger on focus
                                        onBlur={() => setTimeout(() => setActiveAutocomplete(null), 150)} // Delay to allow click on suggestion
                                        className="w-full p-2 bg-gray-50 border border-gray-300 rounded-md text-gray-900 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                    {activeAutocomplete === group.id && currentQuery && (
                                        <div className="absolute bottom-full left-0 right-0 z-10 w-full bg-white border rounded-md mb-1 shadow-lg max-h-48 overflow-y-auto">
                                            {availableStudents.length > 0 ? (
                                                availableStudents.map(student => (
                                                    <div
                                                        key={student.id}
                                                        onMouseDown={() => handleAddStudentToGroup(student, group.id)} // use onMouseDown to fire before blur
                                                        className="p-2 text-gray-800 hover:bg-indigo-100 cursor-pointer"
                                                    >
                                                        {student.name}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-2 text-gray-700 italic">Ученик не найден</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => { setModalOpen(false); }} title="Новая группа">
                <GroupForm
                    group={null}
                    onSave={handleCreate}
                    onCancel={() => { setModalOpen(false); }}
                />
            </Modal>
            <ConfirmationModal
                isOpen={!!groupToDelete}
                onClose={() => setGroupToDelete(null)}
                onConfirm={executeDelete}
                title="Подтверждение удаления"
                message={`Вы уверены, что хотите удалить группу "${groupToDelete?.name}"? Все ученики будут откреплены от нее.`}
                confirmText="Да, удалить"
            />
        </div>
    );
};

export default Groups;