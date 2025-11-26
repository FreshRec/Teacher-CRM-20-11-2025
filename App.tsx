
import React, { useState, useMemo, useEffect } from 'react';
import { View } from './types';
import { DashboardIcon, StudentsIcon, JournalIcon, SubscriptionsIcon, ScheduleIcon, FinanceIcon, ArchiveIcon, MenuIcon, GroupsIcon, LogoutIcon, AdminIcon } from './components/icons';
import Dashboard from './components/Dashboard';
import Students from './components/Students';
import Journal from './components/Journal';
import Subscriptions from './components/Subscriptions';
import Schedule from './components/Schedule';
import Finance from './components/Finance';
import Archive from './components/Archive';
import Groups from './components/Groups';
import AdminPanel from './components/AdminPanel';
import Auth from './components/Auth';
import { supabase } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';

// Fix: Use named import for StudentFinanceHistory
import { StudentFinanceHistory } from './components/StudentFinanceHistory';
import { useAppContext, AppProvider } from './AppContext';

const AuthenticatedApp: React.FC = () => {
    const { students, groups, userProfile } = useAppContext();
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
        // Permission check
        const perms = userProfile?.permissions;
        if (!perms) return <div>Загрузка прав доступа...</div>;

        if (view === 'students' && !perms.canViewStudents) return <div className="p-4 text-red-600">Нет доступа</div>;
        if (view === 'journal' && !perms.canViewJournal) return <div className="p-4 text-red-600">Нет доступа</div>;
        if (view === 'groups' && !perms.canViewGroups) return <div className="p-4 text-red-600">Нет доступа</div>;
        if (view === 'subscriptions' && !perms.canViewSubscriptions) return <div className="p-4 text-red-600">Нет доступа</div>;
        if (view === 'schedule' && !perms.canViewSchedule) return <div className="p-4 text-red-600">Нет доступа</div>;
        if (view === 'finance' && !perms.canViewFinance) return <div className="p-4 text-red-600">Нет доступа</div>;
        if (view === 'archive' && !perms.canViewArchive) return <div className="p-4 text-red-600">Нет доступа</div>;
        if (view === 'admin' && !perms.canManageUsers) return <div className="p-4 text-red-600">Нет доступа</div>;

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
            case 'admin':
                return <AdminPanel />;
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
            admin: 'Администрирование'
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

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    return (
        <div className="relative md:flex min-h-screen bg-gray-100 font-sans">
            {/* Overlay for mobile */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}

            <aside className={`fixed top-0 left-0 h-full w-64 bg-white shadow-md flex-shrink-0 transform transition-transform z-30 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 flex flex-col`}>
                <div className="p-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-indigo-600">Teacher's CRM</h1>
                    {userProfile && (
                        <div className="text-xs text-gray-500 mt-2">
                            {userProfile.email} <br/>
                            <span className="font-semibold text-indigo-500 capitalize">{userProfile.role === 'admin' ? 'Администратор' : 'Учитель'}</span>
                        </div>
                    )}
                </div>
                <nav className="mt-6 px-4 space-y-2 flex-grow">
                    {userProfile?.permissions.canViewDashboard && <NavItem viewName="dashboard" icon={<DashboardIcon />} label="Обзор" />}
                    {userProfile?.permissions.canViewJournal && <NavItem viewName="journal" icon={<JournalIcon />} label="Журнал" />}
                    {userProfile?.permissions.canViewSchedule && <NavItem viewName="schedule" icon={<ScheduleIcon />} label="Расписание" />}
                    {userProfile?.permissions.canViewGroups && <NavItem viewName="groups" icon={<GroupsIcon />} label="Группы" />}
                    {userProfile?.permissions.canViewStudents && <NavItem viewName="students" icon={<StudentsIcon />} label="Ученики" />}
                    {userProfile?.permissions.canViewSubscriptions && <NavItem viewName="subscriptions" icon={<SubscriptionsIcon />} label="Абонементы" />}
                    {userProfile?.permissions.canViewFinance && <NavItem viewName="finance" icon={<FinanceIcon />} label="Финансы" />}
                    {userProfile?.permissions.canViewArchive && <NavItem viewName="archive" icon={<ArchiveIcon />} label="Архив" />}
                    {userProfile?.permissions.canManageUsers && <NavItem viewName="admin" icon={<AdminIcon />} label="Администрирование" />}
                </nav>
                <div className="p-4 border-t">
                    <button 
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-3 text-sm md:text-lg font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <span className="mr-3"><LogoutIcon /></span>
                        Выйти
                    </button>
                </div>
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

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-100">
                 <svg className="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
            </div>
        )
    }

    if (!session) {
        return <Auth />;
    }

    return (
        <AppProvider>
            <AuthenticatedApp />
        </AppProvider>
    );
};

export default App;
