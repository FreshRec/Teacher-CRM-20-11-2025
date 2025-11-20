import React, { useState } from 'react';
import { View } from '../types';
import { useAppContext } from '../AppContext';
import { StudentsIcon, GroupsIcon, ScheduleIcon } from './icons';
import { ConfirmationModal } from './Modal';

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}> = ({ icon, label, value, color }) => (
  <div className={`p-6 rounded-lg shadow-md flex items-center space-x-4 ${color}`}>
    <div className="text-white p-3 bg-black bg-opacity-20 rounded-full">{icon}</div>
    <div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-white md:text-lg">{label}</p>
    </div>
  </div>
);

const Dashboard: React.FC<{ navigateTo: (view: View) => void }> = ({ navigateTo }) => {
  const { students, groups, allVisibleEvents, clearStudentFinancialData } = useAppContext();
  const [isClearDataModalOpen, setClearDataModalOpen] = useState(false);

  const activeStudentsCount = students.filter(s => s.status === 'active').length;
  const groupsCount = groups.length;
  
  const upcomingEvents = allVisibleEvents
    .filter(event => {
      if (!event || !event.start) return false;
      const eventDate = new Date(event.start);
      return !isNaN(eventDate.getTime()) && eventDate > new Date();
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 5);

  const handleClearData = async () => {
    await clearStudentFinancialData();
    setClearDataModalOpen(false);
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard icon={<StudentsIcon />} label="Активных учеников" value={activeStudentsCount} color="bg-indigo-500" />
        <StatCard icon={<GroupsIcon />} label="Групп" value={groupsCount} color="bg-green-500" />
        <StatCard icon={<ScheduleIcon />} label="Предстоящих событий" value={upcomingEvents.length} color="bg-blue-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl md:text-2xl md:font-bold font-semibold text-gray-700 mb-4">Быстрые действия</h3>
          <div className="flex flex-wrap gap-4">
            <button onClick={() => navigateTo('journal')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700">Открыть Журнал</button>
            <button onClick={() => navigateTo('schedule')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700">Расписание</button>
            <button onClick={() => navigateTo('students')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700">Список учеников</button>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl md:text-2xl md:font-bold font-semibold text-gray-700 mb-4">Ближайшие занятия</h3>
          {upcomingEvents.length > 0 ? (
            <ul className="space-y-3">
              {upcomingEvents.map(event => (
                <li key={event.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                  <div>
                    <p className="font-semibold text-gray-800 md:text-lg">{event.title}</p>
                    <p className="text-sm md:text-base text-gray-500">{new Date(event.start).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">Предстоящих занятий нет.</p>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mt-8">
          <h3 className="text-xl md:text-2xl md:font-bold font-semibold text-red-700 mb-4">Опасная зона</h3>
          <p className="text-gray-600 md:text-lg mb-4">
              Это действие необратимо. Будут удалены все финансовые операции,
              купленные абонементы и история посещаемости всех учеников.
              Сами ученики, группы и расписание останутся.
          </p>
          <button
              onClick={() => setClearDataModalOpen(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition"
          >
              Очистить данные учеников
          </button>
      </div>

      <ConfirmationModal
          isOpen={isClearDataModalOpen}
          onClose={() => setClearDataModalOpen(false)}
          onConfirm={handleClearData}
          title="Подтверждение очистки данных"
          message="Вы уверены, что хотите навсегда удалить ВСЕ финансовые данные и историю посещаемости? Это действие нельзя отменить."
          confirmText="Да, удалить все"
      />
    </div>
  );
};

export default Dashboard;