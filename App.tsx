import React, { useState, useMemo, useEffect } from 'react';
import { View } from './types';
import { DashboardIcon, StudentsIcon, JournalIcon, SubscriptionsIcon, ScheduleIcon, FinanceIcon, ArchiveIcon, MenuIcon, GroupsIcon } from './components/icons';
import Dashboard from './components/Dashboard';
import Students from './components/Students';
import Journal from './components/Journal';
import Subscriptions from './components/Subscriptions';
import Schedule from './components/Schedule';
import Finance from './components/Finance';
import Archive from './components/Archive';
import Groups from './components/Groups';
// Fix: Use named import for StudentFinanceHistory
import { StudentFinanceHistory } from './components/StudentFinanceHistory';
import { useAppContext } from './AppContext';

const App: React.FC = () => {
    const { students, groups } = useAppContext();
    const [view, setView] = useState<View>('dashboard');
    const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState(window.matchMedia('(min-width: 768px)').matches);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 768px)');
        const handler = () => setIsDesktop(mediaQuery.matches);
        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);
    
    // State for Journal
    const [journalDate, setJournalDate] = useState(new Date());
    const [journalGroupId, setJournalGroupId] = useState<string>('');
    
    // State for Schedule
    const [scheduleDate, setScheduleDate] = useState(new Date());
    const [calendarView, setCalendarView] = useState<'week' | 'month' | 'year'>('week');
    const [triggerAddScheduleEvent, setTriggerAddScheduleEvent] = useState(0);

    // State for Students
    const [triggerAddStudent, setTriggerAddStudent] = useState(0);

    // State for Groups
    const [triggerAddGroup, setTriggerAddGroup] = useState(0);

    // State for Subscriptions
    const [triggerAddSubscription, setTriggerAddSubscription] = useState(0);

    const navigateTo = (view: View, studentId: string | null = null) => {
        setView(view);
        setActiveStudentId(studentId);
    };

    const changeJournalPeriod = (offset: number) => {
        setJournalDate(prev => {
            const newDate = new Date(prev);
            if (isDesktop) {
                newDate.setMonth(prev.getMonth() + offset);
            } else {
                newDate.setDate(prev.getDate() + offset * 7);
            }
            return newDate;
        });
    };
    
    const changeSchedulePeriod = (offset: number) => {
        setScheduleDate(prev => {
            const newDate = new Date(prev);
            if (calendarView === 'week') newDate.setDate(prev.getDate() + offset * 7);
            if (calendarView === 'month') newDate.setMonth(prev.getMonth() + offset);
            if (calendarView === 'year') newDate.setFullYear(prev.getFullYear() + offset);
            return newDate;
        });
    };

    const sortedGroups = useMemo(() => [...groups].sort((a,b) => a.name.localeCompare(b.name)), [groups]);
    const locale = 'ru-RU';

    const journalWeekDays = useMemo(() => {
        const startOfWeek = new Date(journalDate);
        startOfWeek.setHours(0, 0, 0, 0);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        return Array.from({ length: 7 }, (_, i) => {
            const newDay = new Date(startOfWeek);
            newDay.setDate(startOfWeek.getDate() + i);
            return newDay;
        });
    }, [journalDate]);
    
    useEffect(() => {
        if (view === 'journal' && groups.length > 0 && !journalGroupId) {
            setJournalGroupId(sortedGroups[0].id);
        }
    }, [view, groups, journalGroupId, sortedGroups]);


    const renderView = () => {
        switch (view) {
            case 'dashboard':
                return <Dashboard navigateTo={navigateTo} />;
            case 'students':
                return <Students triggerAddStudent={triggerAddStudent} />;
            case 'journal':
                return <Journal 
                            currentDate={journalDate} 
                            selectedGroupId={journalGroupId}
                            isDesktop={isDesktop}
                        />;
            case 'groups':
                return <Groups triggerAddGroup={triggerAddGroup} />;
            case 'subscriptions':
                return <Subscriptions triggerAddSubscription={triggerAddSubscription} />;
            case 'schedule':
                return <Schedule 
                            currentDate={scheduleDate}
                            setCurrentDate={setScheduleDate}
                            calendarView={calendarView}
                            setCalendarView={setCalendarView}
                            triggerAddEvent={triggerAddScheduleEvent}
                        />;
            case 'finance':
                return <Finance navigateTo={navigateTo} />;
            case 'studentFinance':
                return activeStudentId ? <StudentFinanceHistory studentId={activeStudentId} navigateTo={navigateTo} /> : <Finance navigateTo={navigateTo} />;
            case 'archive':
                return <Archive />;
            default:
                return <Journal 
                            currentDate={journalDate} 
                            selectedGroupId={journalGroupId} 
                            isDesktop={isDesktop}
                        />;
        }
    };
    
    const renderHeaderContent = () => {
        const titleMap: Record<string, string> = {
            dashboard: 'Обзор',
            archive: 'Архив',
        };

        switch (view) {
            case 'students':
                return (
                    <div className="flex justify-between items-center w-full">
                        <h2 className="text-3xl font-bold text-gray-800 md:text-4xl">Ученики</h2>
                        <button 
                            onClick={() => setTriggerAddStudent(c => c + 1)} 
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition md:text-lg"
                        >
                            Добавить ученика
                        </button>
                    </div>
                );
             case 'groups':
                return (
                    <div className="flex justify-between items-center w-full">
                        <h2 className="text-3xl font-bold text-gray-800 md:text-4xl">Группы</h2>
                        <button
                            onClick={() => setTriggerAddGroup(c => c + 1)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition md:text-lg"
                        >
                            Добавить группу
                        </button>
                    </div>
                );
            case 'subscriptions':
                return (
                    <div className="flex justify-between items-center w-full">
                        <h2 className="text-3xl font-bold text-gray-800 md:text-4xl">Абонементы</h2>
                        <button
                            onClick={() => setTriggerAddSubscription(c => c + 1)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition md:text-lg"
                        >
                            Добавить абонемент
                        </button>
                    </div>
                );
            case 'journal': {
                const journalDateDisplayRaw = isDesktop
                    ? journalDate.toLocaleString(locale, { month: 'long', year: 'numeric' })
                    : `${journalWeekDays[0].toLocaleDateString(locale, {day: 'numeric', month: 'short'})} - ${journalWeekDays[6].toLocaleDateString(locale, {day: 'numeric', month: 'short'})}`;
                const journalDateDisplay = journalDateDisplayRaw.charAt(0).toUpperCase() + journalDateDisplayRaw.slice(1);

                return (
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                        <h2 className="hidden md:block text-4xl font-bold text-gray-800">Журнал</h2>
                        <div className="flex justify-center flex-grow">
                             <div className="flex items-center space-x-1 md:space-x-2">
                                <button onClick={() => changeJournalPeriod(-1)} className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <span className="font-semibold text-lg md:font-bold md:text-2xl text-gray-800 w-auto text-center capitalize whitespace-nowrap">
                                    {journalDateDisplay}
                                </span>
                                <button onClick={() => changeJournalPeriod(1)} className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        </div>
                        <div>
                            <select
                                id="group-select" value={journalGroupId}
                                onChange={(e) => setJournalGroupId(e.target.value)}
                                className="w-full md:w-auto p-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 md:text-lg"
                                disabled={groups.length === 0}
                            >
                                {groups.length > 0 ? (
                                   sortedGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)
                                ) : ( <option value="">Сначала создайте группу</option> )}
                            </select>
                        </div>
                    </div>
                );
            }
            case 'schedule': {
                type CalendarView = 'week' | 'month' | 'year';
                const ViewButton: React.FC<{ view: CalendarView, label: string }> = ({ view, label }) => (
                    <button onClick={() => setCalendarView(view)} className={`px-3 py-1 text-sm md:text-base rounded-md ${calendarView === view ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'}`}>{label}</button>
                );
                
                const getScheduleDateDisplay = () => {
                     if (calendarView === 'week') {
                        const startOfWeek = new Date(scheduleDate);
                        startOfWeek.setHours(0, 0, 0, 0);
                        const day = startOfWeek.getDay();
                        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
                        startOfWeek.setDate(diff);
                        const endOfWeek = new Date(startOfWeek);
                        endOfWeek.setDate(startOfWeek.getDate() + 6);
                        
                        return startOfWeek.getMonth() === endOfWeek.getMonth()
                            ? `${startOfWeek.getDate()} - ${endOfWeek.getDate()} ${endOfWeek.toLocaleString(locale, {month: 'long'})} ${endOfWeek.getFullYear()}`
                            : `${startOfWeek.toLocaleDateString(locale, {day: '2-digit', month: 'short'})} - ${endOfWeek.toLocaleDateString(locale, {day: '2-digit', month: 'short', year: 'numeric'})}`;
                     }
                     return calendarView === 'year' ? scheduleDate.getFullYear().toString() : scheduleDate.toLocaleString(locale, { month: 'long', year: 'numeric' });
                };

                return (
                     <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-2">
                        <h2 className="hidden md:block text-4xl font-bold text-gray-800">Расписание</h2>
                        <div className="flex justify-center md:flex-grow order-2 md:order-none">
                             <div className="flex items-center space-x-1">
                                <button onClick={() => changeSchedulePeriod(-1)} className="p-2 text-indigo-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg></button>
                                <span className="text-lg md:text-2xl md:font-bold w-64 text-center text-gray-800">{getScheduleDateDisplay()}</span>
                                <button onClick={() => changeSchedulePeriod(1)} className="p-2 text-indigo-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg></button>
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto order-1 md:order-none">
                            <div className="flex items-center space-x-2 bg-gray-200 p-1 rounded-lg">
                                <ViewButton view="week" label="Неделя" /><ViewButton view="month" label="Месяц" /><ViewButton view="year" label="Год" />
                            </div>
                            <button onClick={() => setTriggerAddScheduleEvent(c => c + 1)} className="hidden md:block px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 w-full md:w-auto md:text-lg">Добавить занятие</button>
                        </div>
                    </div>
                );
            }
            case 'finance':
                 return <h2 className="text-3xl font-bold text-gray-800 md:text-4xl">Финансы</h2>;
            case 'studentFinance': {
                const student = students.find(s => s.id === activeStudentId);
                return <h2 className="text-3xl font-bold text-gray-800 md:text-4xl">Финансовая история: {student?.name || ''}</h2>;
            }
            default:
                return titleMap[view] ? <h2 className="text-3xl font-bold text-gray-800 md:text-4xl">{titleMap[view]}</h2> : null;
        }
    }
    
    const NavItem: React.FC<{ viewName: View; icon: React.ReactNode; label: string }> = ({ viewName, icon, label }) => (
        <button 
            onClick={() => {
                navigateTo(viewName);
                setSidebarOpen(false); // Close sidebar on navigation
            }} 
            className={`flex items-center w-full px-4 py-3 text-sm md:text-lg font-medium rounded-lg transition-colors ${view === viewName ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}
        >
            <span className="mr-3">{icon}</span>
            {label}
        </button>
    );

    return (
        <div className="relative md:flex min-h-screen bg-gray-100 font-sans">
            {/* Overlay for mobile */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}

            <aside className={`fixed top-0 left-0 h-full w-64 bg-white shadow-md flex-shrink-0 transform transition-transform z-30 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
                <div className="p-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-indigo-600">Teacher's CRM</h1>
                </div>
                <nav className="mt-6 px-4 space-y-2">
                    <NavItem viewName="dashboard" icon={<DashboardIcon />} label="Обзор" />
                    <NavItem viewName="journal" icon={<JournalIcon />} label="Журнал" />
                    <NavItem viewName="schedule" icon={<ScheduleIcon />} label="Расписание" />
                    <NavItem viewName="groups" icon={<GroupsIcon />} label="Группы" />
                    <NavItem viewName="students" icon={<StudentsIcon />} label="Ученики" />
                    <NavItem viewName="subscriptions" icon={<SubscriptionsIcon />} label="Абонементы" />
                    <NavItem viewName="finance" icon={<FinanceIcon />} label="Финансы" />
                    <NavItem viewName="archive" icon={<ArchiveIcon />} label="Архив" />
                </nav>
            </aside>

            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                 <header className="flex items-start mb-6">
                     <button 
                        className="md:hidden p-2 text-gray-600"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <MenuIcon className="h-6 w-6" />
                    </button>
                    <div className="flex-grow md:ml-2">
                        {renderHeaderContent()}
                    </div>
                </header>
                {renderView()}
            </main>
        </div>
    );
};

export default App;
