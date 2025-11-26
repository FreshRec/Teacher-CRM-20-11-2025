
import React, { useState } from 'react';
import { useAppContext } from '../AppContext';
import { UserProfile, UserPermissions } from '../types';

const permissionsLabels: Record<keyof UserPermissions, string> = {
    canViewDashboard: 'Обзор',
    canViewStudents: 'Ученики',
    canViewJournal: 'Журнал',
    canViewGroups: 'Группы',
    canViewSubscriptions: 'Абонементы',
    canViewSchedule: 'Расписание',
    canViewFinance: 'Финансы',
    canViewArchive: 'Архив',
    canManageUsers: 'Управление пользователями'
};

const AdminPanel: React.FC = () => {
    const { allProfiles, updateUserProfile, userProfile: currentUser } = useAppContext();
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

    const togglePermission = async (profile: UserProfile, permKey: keyof UserPermissions) => {
        const newPermissions = {
            ...profile.permissions,
            [permKey]: !profile.permissions[permKey]
        };
        await updateUserProfile(profile.id, { permissions: newPermissions });
    };

    const changeRole = async (profile: UserProfile, newRole: 'admin' | 'teacher') => {
        if (profile.id === currentUser?.id) {
            if (!window.confirm("Вы уверены, что хотите изменить свою роль? Вы можете потерять доступ к админ-панели.")) return;
        }
        await updateUserProfile(profile.id, { role: newRole });
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Управление пользователями</h2>
                <p className="text-gray-600 mb-6">
                    Здесь вы можете управлять ролями и правами доступа всех зарегистрированных пользователей.
                    Новые пользователи появляются здесь автоматически после первой регистрации.
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100 border-b">
                                <th className="p-4 font-semibold text-gray-700">Email</th>
                                <th className="p-4 font-semibold text-gray-700">Роль</th>
                                <th className="p-4 font-semibold text-gray-700">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allProfiles.map(profile => (
                                <React.Fragment key={profile.id}>
                                    <tr className="border-b hover:bg-gray-50">
                                        <td className="p-4 text-gray-800 font-medium">{profile.email}</td>
                                        <td className="p-4">
                                            <select 
                                                value={profile.role}
                                                onChange={(e) => changeRole(profile, e.target.value as 'admin' | 'teacher')}
                                                className="p-2 border rounded-md bg-white text-gray-800 text-sm focus:ring-indigo-500"
                                            >
                                                <option value="teacher">Учитель</option>
                                                <option value="admin">Администратор</option>
                                            </select>
                                        </td>
                                        <td className="p-4">
                                            <button 
                                                onClick={() => setExpandedUserId(expandedUserId === profile.id ? null : profile.id)}
                                                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                                            >
                                                {expandedUserId === profile.id ? 'Скрыть права' : 'Настроить права'}
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedUserId === profile.id && (
                                        <tr className="bg-gray-50 border-b">
                                            <td colSpan={3} className="p-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {(Object.keys(permissionsLabels) as Array<keyof UserPermissions>).map(key => (
                                                        <label key={key} className="flex items-center space-x-2 cursor-pointer">
                                                            <input 
                                                                type="checkbox"
                                                                checked={!!profile.permissions[key]}
                                                                onChange={() => togglePermission(profile, key)}
                                                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                            />
                                                            <span className="text-sm text-gray-700">{permissionsLabels[key]}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
