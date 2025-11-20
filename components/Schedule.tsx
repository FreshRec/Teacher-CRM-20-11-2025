import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ScheduleEvent, Group, ScheduleEventForCreation, ScheduleEventException, DisplayEvent } from '../types';
import Modal, { ConfirmationModal } from './Modal';
import { useAppContext } from '../AppContext';

// Generates a stable, timezone-agnostic key for an event occurrence.
// e.g., '2024-08-15T09:00'
const getOccurrenceKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};


const formatDateForLocalInput = (isoString: string): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
        console.error("Invalid date string passed to formatDateForLocalInput:", isoString);
        return '';
    }
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - timezoneOffset);
    return localDate.toISOString().slice(0, 16);
};


const EventForm: React.FC<{
    event: Partial<DisplayEvent> | null;
    onSave: (updates: Partial<ScheduleEvent>, scope: 'single' | 'all') => void;
    onCancel: () => void;
    onDelete: (scope: 'single' | 'all') => void;
    groups: Group[];
}> = ({ event, onSave, onCancel, onDelete, groups }) => {
    const [formData, setFormData] = useState({
        title: event?.title || '',
        group_id: event?.group_id || '',
        start: event?.start ? formatDateForLocalInput(event.start) : '',
        end: event?.end ? formatDateForLocalInput(event.end) : '',
        is_recurring: event?.is_recurring || false,
    });
     
    useEffect(() => {
        setFormData({
            title: event?.title || '',
            group_id: event?.group_id || '',
            start: event?.start ? formatDateForLocalInput(event.start) : '',
            end: event?.end ? formatDateForLocalInput(event.end) : '',
            is_recurring: event?.is_recurring || false,
        });
    }, [event]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
             setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            if (name === 'start') {
                const newStartDate = new Date(value);
                const newEndDate = new Date(newStartDate.getTime() + 60 * 60 * 1000); // Add 1 hour
                const newEndValue = formatDateForLocalInput(newEndDate.toISOString());
                setFormData(prev => ({ ...prev, start: value, end: newEndValue }));
            } else {
                setFormData(prev => ({ ...prev, [name]: value }));
            }
        }
    };

    const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const groupId = e.target.value;
        const group = groups.find(g => g.id === groupId);
        setFormData(prev => ({
            ...prev,
            group_id: groupId,
            title: group && !formData.title ? group.name : formData.title
        }));
    };
    
    const [scopeModal, setScopeModal] = useState<'save' | 'delete' | null>(null);

    const handleSubmit = () => {
        if (!formData.title.trim()) return;
        if (new Date(formData.end) <= new Date(formData.start)) {
            alert("Время окончания должно быть позже времени начала.");
            return;
        }

        if (event?.is_recurring && event?.isVirtual) {
            setScopeModal('save');
        } else {
            onSave(formData, 'all');
        }
    };

    const handleDeleteClick = () => {
         if (event?.is_recurring && event?.isVirtual) {
            setScopeModal('delete');
        } else {
            onDelete('all');
        }
    }
    
    const handleScopeSelection = (scope: 'single' | 'all') => {
        if (scopeModal === 'save') {
             onSave(formData, scope);
        } else if (scopeModal === 'delete') {
            onDelete(scope);
        }
        setScopeModal(null);
    };

    const inputStyle = "w-full p-2 bg-gray-50 border border-gray-300 rounded-md text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white";

    return (
        <>
        <div className="space-y-4">
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название события</label>
                <input type="text" name="title" value={formData.title} onChange={handleChange} className={inputStyle} placeholder="Название встречи или урока" required />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Группа (необязательно)</label>
                <select name="group_id" value={formData.group_id || ''} onChange={handleGroupChange} className={inputStyle}>
                    <option value="">Без группы</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
            </div>
            <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Начало</label>
                <input type="datetime-local" name="start" value={formData.start} onChange={handleChange} className={inputStyle} required />
            </div>
            <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Окончание</label>
                <input type="datetime-local" name="end" value={formData.end} onChange={handleChange} className={inputStyle} required min={formData.start} />
            </div>
            <label className="flex items-center space-x-2 text-gray-700">
                <input type="checkbox" name="is_recurring" checked={formData.is_recurring} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                <span>Повторять еженедельно</span>
            </label>
            <div className="flex justify-between items-center mt-6">
                <div>
                    {event?.id && (
                        <button type="button" onClick={handleDeleteClick} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Удалить</button>
                    )}
                </div>
                <div className="flex space-x-3">
                    <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">Отмена</button>
                    <button type="button" onClick={handleSubmit} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Сохранить</button>
                </div>
            </div>
        </div>
        
        {scopeModal && (
             <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center" onClick={() => setScopeModal(null)}>
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-bold">Изменить повторяющееся событие</h3>
                    <p className="mt-2 text-gray-600">
                        {scopeModal === 'save' ? 'Вы хотите изменить только это событие или всю серию?' : 'Вы хотите удалить только это событие или всю серию?'}
                    </p>
                    <div className="mt-6 flex flex-col space-y-2">
                        <button onClick={() => handleScopeSelection('single')} className="w-full px-4 py-2 bg-indigo-100 text-indigo-800 rounded hover:bg-indigo-200">Только это событие</button>
                        <button onClick={() => handleScopeSelection('all')} className="w-full px-4 py-2 bg-indigo-100 text-indigo-800 rounded hover:bg-indigo-200">Все события в серии</button>
                        <button onClick={() => setScopeModal(null)} className="w-full mt-2 px-4 py-2 text-gray-600 hover:bg-gray-100">Отмена</button>
                    </div>
                </div>
             </div>
        )}
        </>
    );
};

type CalendarView = 'week' | 'month' | 'year';

interface ScheduleProps {
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    calendarView: CalendarView;
    setCalendarView: (view: CalendarView) => void;
    triggerAddEvent: number;
}


const Schedule: React.FC<ScheduleProps> = ({ 
    currentDate, 
    setCurrentDate, 
    calendarView, 
    setCalendarView, 
    triggerAddEvent 
}) => {
    const { 
        allVisibleEvents,
        groups, 
        showNotification,
        addScheduleEvent,
        updateScheduleEvent,
        deleteScheduleEvent,
        addEventException,
    } = useAppContext();
    
    const [isModalOpen, setModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<DisplayEvent | Partial<DisplayEvent> | null>(null);
    const [eventToDelete, setEventToDelete] = useState<{event: DisplayEvent, scope: 'single' | 'all'} | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // For moving existing events
    const [draggedEvent, setDraggedEvent] = useState<{ event: DisplayEvent; element: HTMLElement; offsetX: number; offsetY: number; } | null>(null);
    const [dropIndicator, setDropIndicator] = useState<{ top: number; left: number; height: number; width: number; day: Date; } | null>(null);
    
    // For creating new events
    const [selectionArea, setSelectionArea] = useState<{ dayIndex: number; startY: number; currentY: number; } | null>(null);
    
    // For resizing events
    const [resizingEvent, setResizingEvent] = useState<{
        event: DisplayEvent;
        direction: 'top' | 'bottom';
    } | null>(null);

    const longPressTimerRef = useRef<number | null>(null);
    const locale = 'ru-RU';

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const touchStartRef = useRef<{ y: number; x: number; moved: boolean } | null>(null);
    
    const HOUR_HEIGHT = 60;
    const HOURS = Array.from({ length: 24 }, (_, i) => i); 

    useEffect(() => {
        if (triggerAddEvent > 0) {
            openModal({});
        }
    }, [triggerAddEvent]);

    const weekDays = useMemo(() => {
        const startOfWeek = new Date(currentDate);
        startOfWeek.setHours(0, 0, 0, 0);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        return Array.from({ length: 7 }, (_, i) => {
            const newDay = new Date(startOfWeek);
            newDay.setDate(startOfWeek.getDate() + i);
            return newDay;
        });
    }, [currentDate]);
    
    const monthGrid = useMemo(() => {
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        const startDate = new Date(startOfMonth);
        const startDayOfWeek = startDate.getDay();
        const diff = startDayOfWeek === 0 ? -6 : 1 - startDayOfWeek;
        startDate.setDate(startDate.getDate() + diff);

        const grid: { date: Date, isCurrentMonth: boolean }[] = [];
        for (let i = 0; i < 42; i++) { // 6 weeks grid
            const day = new Date(startDate);
            day.setDate(startDate.getDate() + i);
            grid.push({
                date: day,
                isCurrentMonth: day.getMonth() === currentDate.getMonth()
            });
        }
        return grid;
    }, [currentDate]);

    useEffect(() => {
        if (calendarView === 'week' && scrollContainerRef.current) {
            const timer = setTimeout(() => { if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 8 * HOUR_HEIGHT; }, 50);
            return () => clearTimeout(timer);
        }
    }, [calendarView, weekDays]);
    
    const yToTime = (y: number, day: Date): Date => {
        const totalHours = Math.max(0, y / HOUR_HEIGHT);
        const hour = Math.floor(totalHours);
        const minute = Math.round((totalHours % 1) * 60 / 15) * 15;
        return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
    };
    
    const timeToY = (isoString: string) => {
        if (!isoString) return 0;
        const date = new Date(isoString);
        if (isNaN(date.getTime())) {
            console.error("Invalid date string passed to timeToY:", isoString);
            return 0;
        }
        return (date.getHours() + date.getMinutes() / 60) * HOUR_HEIGHT;
    };
    
    const openModal = (event: DisplayEvent | Partial<DisplayEvent>) => {
        setSelectedEvent(event);
        setModalOpen(true);
    };

    const handleSaveEvent = useCallback(async (eventToSave: DisplayEvent, scope: 'single' | 'all') => {
        const eventData = {
            title: eventToSave.title,
            group_id: eventToSave.group_id || null, // Ensure null is sent for "no group"
            start: new Date(eventToSave.start!).toISOString(),
            end: new Date(eventToSave.end!).toISOString(),
            is_recurring: eventToSave.is_recurring,
        };
    
        if (!eventToSave.originalId) { // A brand new event
            await addScheduleEvent(eventData as ScheduleEventForCreation);
            showNotification('Занятие добавлено в расписание.');
        } else if (scope === 'all') { // Update series (or non-recurring)
            await updateScheduleEvent(eventToSave.originalId, eventData);
            showNotification('Серия занятий обновлена.');
        } else if (scope === 'single') { // Create exception for a single occurrence
            await addEventException({
                original_event_id: eventToSave.originalId,
                original_start_time: eventToSave.occurrence_key,
                new_title: eventData.title,
                new_group_id: eventData.group_id,
                new_start_time: eventData.start,
                new_end_time: eventData.end,
                is_deleted: false,
            });
            showNotification('Только это занятие было изменено.');
        }
        
        setModalOpen(false);
        setSelectedEvent(null);
    }, [addScheduleEvent, updateScheduleEvent, addEventException, showNotification]);
    
    const handleSaveFromModal = (updates: Partial<ScheduleEvent>, scope: 'single' | 'all') => {
        const eventToSave = { ...(selectedEvent as DisplayEvent), ...updates };
        handleSaveEvent(eventToSave, scope);
    };

    const handleDeleteEvent = (scope: 'single' | 'all') => {
        const event = selectedEvent as DisplayEvent;
        if (event) {
            setModalOpen(false);
            setEventToDelete({ event, scope });
        }
    };
    
    const executeDelete = async () => {
        if (!eventToDelete) return;
        const { event, scope } = eventToDelete;
        
        if (scope === 'all') {
            await deleteScheduleEvent(event.originalId);
            showNotification('Вся серия занятий удалена.', 'error');
        } else {
             await addEventException({
                original_event_id: event.originalId,
                original_start_time: event.occurrence_key,
                is_deleted: true,
            });
            showNotification('Только это занятие было удалено.', 'error');
        }
        
        setEventToDelete(null);
    };

    // --- Mobile Tap-to-Create ---
    const handleTouchStartOnGrid = (e: React.TouchEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('.event-item')) return;
        const touch = e.touches[0];
        touchStartRef.current = { y: touch.clientY, x: touch.clientX, moved: false };
    };

    const handleTouchMoveOnGrid = (e: React.TouchEvent<HTMLDivElement>) => {
        if (!touchStartRef.current || touchStartRef.current.moved) return;
        const touch = e.touches[0];
        if (Math.abs(touch.clientY - touchStartRef.current.y) > 10 || Math.abs(touch.clientX - touchStartRef.current.x) > 10) {
            touchStartRef.current.moved = true;
        }
    };

    const handleTouchEndOnGrid = (dayIndex: number) => {
        if (!touchStartRef.current || touchStartRef.current.moved) {
            touchStartRef.current = null; return;
        }
        const { y: clientY } = touchStartRef.current;
        touchStartRef.current = null;

        if (!scrollContainerRef.current || !headerRef.current) return;
        
        const gridRect = scrollContainerRef.current.getBoundingClientRect();
        const headerHeight = headerRef.current.offsetHeight;
        const tapY = clientY - gridRect.top - headerHeight + scrollContainerRef.current.scrollTop;
        
        const tappedDate = yToTime(tapY, weekDays[dayIndex]);
        const startDate = new Date(tappedDate);
        startDate.setMinutes(0, 0, 0); // Snap to the beginning of the hour
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        
        openModal({ start: startDate.toISOString(), end: endDate.toISOString() });
    };

    // --- Desktop Click-and-Drag to Create ---
    const handleMouseDownOnGrid = (e: React.MouseEvent<HTMLDivElement>, dayIndex: number) => {
        if (e.button !== 0 || (e.target as HTMLElement).closest('.event-item')) return;
        
        if (!scrollContainerRef.current || !headerRef.current) return;
        const gridRect = scrollContainerRef.current.getBoundingClientRect();
        const headerHeight = headerRef.current.offsetHeight;
        const startY = e.clientY - gridRect.top - headerHeight + scrollContainerRef.current.scrollTop;
        
        setSelectionArea({ dayIndex, startY, currentY: startY });
        
        const handleMouseMove = (moveEvent: MouseEvent) => {
            const currentY = moveEvent.clientY - gridRect.top - headerHeight + scrollContainerRef.current.scrollTop;
            setSelectionArea(prev => prev ? { ...prev, currentY } : null);
        };

        const handleMouseUp = (upEvent: MouseEvent) => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);

            setSelectionArea(prevArea => {
                if (!prevArea) return null;

                if (Math.abs(prevArea.currentY - prevArea.startY) > 10) { // Drag-to-create
                    const top = Math.min(prevArea.startY, prevArea.currentY);
                    const bottom = Math.max(prevArea.startY, prevArea.currentY);
                    const day = weekDays[prevArea.dayIndex];
                    const startTime = yToTime(top, day);
                    const endTime = yToTime(bottom, day);
                    openModal({ start: startTime.toISOString(), end: endTime.toISOString() });
                } else { // Click-to-create
                    const day = weekDays[prevArea.dayIndex];
                    const clickedTime = yToTime(prevArea.startY, day);
                    
                    const startTime = new Date(clickedTime);
                    startTime.setMinutes(0, 0, 0); // Snap to the beginning of the hour

                    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Add 1 hour

                    openModal({ start: startTime.toISOString(), end: endTime.toISOString() });
                }
                return null;
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // --- Drag and Drop Existing Event ---
    const handleDragStart = (e: React.MouseEvent<HTMLDivElement>, event: DisplayEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (e.button !== 0) return;
    
        const element = e.currentTarget;
        const startPos = { x: e.clientX, y: e.clientY };
        let isClick = true;
    
        const handleWindowMouseMove = (moveEvent: MouseEvent) => {
            const dx = Math.abs(moveEvent.clientX - startPos.x);
            const dy = Math.abs(moveEvent.clientY - startPos.y);
            
            if (dx > 5 || dy > 5) {
                isClick = false;
                // It's a drag, remove these temporary listeners and start the actual drag logic.
                window.removeEventListener('mousemove', handleWindowMouseMove);
                window.removeEventListener('mouseup', handleWindowMouseUp);
    
                if (element) {
                    const rect = element.getBoundingClientRect();
                    document.body.style.userSelect = 'none';
                    setDraggedEvent({ event, element, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top });
                }
            }
        };
    
        const handleWindowMouseUp = () => {
            // This is the definitive end of the click/drag detection phase.
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
            if (isClick) {
                openModal(event);
            }
        };
        
        // Attach temporary listeners to detect if it's a drag or a click.
        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);
    };

    const handleTouchDragStart = (e: React.TouchEvent<HTMLDivElement>, event: DisplayEvent) => {
        e.stopPropagation();
        const touch = e.touches[0];
        const element = e.currentTarget;
        const rect = element.getBoundingClientRect();

        longPressTimerRef.current = window.setTimeout(() => {
            document.body.style.userSelect = 'none';
            setDraggedEvent({ event, element, offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top });
            longPressTimerRef.current = null;
        }, 300);

        const cancelLongPress = () => {
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
            cleanup();
        };

        const handleEnd = () => {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                openModal(event);
            }
            cleanup();
        };

        const cleanup = () => {
            element.removeEventListener('touchmove', cancelLongPress);
            element.removeEventListener('touchend', handleEnd);
            element.removeEventListener('touchcancel', handleEnd);
        };

        element.addEventListener('touchmove', cancelLongPress);
        element.addEventListener('touchend', handleEnd);
        element.addEventListener('touchcancel', handleEnd);
    };

    useEffect(() => {
        const handleDragMove = (e: MouseEvent | TouchEvent) => {
            if (!draggedEvent || !scrollContainerRef.current || !headerRef.current) return;

            if (e.cancelable) e.preventDefault();

            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            
            draggedEvent.element.style.opacity = '0.3';

            const gridRect = scrollContainerRef.current.getBoundingClientRect();
            const gridX = clientX - gridRect.left;
            const timeColWidth = 56; // w-14
            const dayColWidth = (gridRect.width - timeColWidth) / 7;
            const dayIndex = Math.min(6, Math.max(0, Math.floor((gridX - timeColWidth) / dayColWidth)));
            
            const day = weekDays[dayIndex];
            const headerHeight = headerRef.current.offsetHeight;
            const scrollY = scrollContainerRef.current.scrollTop;
            const rawY = clientY - gridRect.top - headerHeight + scrollY - draggedEvent.offsetY;
            
            const newStartTime = yToTime(rawY, day);
            
            const duration = new Date(draggedEvent.event.end).getTime() - new Date(draggedEvent.event.start).getTime();
            const newEndTime = new Date(newStartTime.getTime() + duration);

            const dayColumn = scrollContainerRef.current.querySelectorAll('.day-column')[dayIndex] as HTMLElement;
            if (dayColumn) {
                 setDropIndicator({
                    top: timeToY(newStartTime.toISOString()),
                    left: dayColumn.offsetLeft,
                    height: timeToY(newEndTime.toISOString()) - timeToY(newStartTime.toISOString()),
                    width: dayColumn.offsetWidth,
                    day: newStartTime,
                });
            }
             // Auto-scroll
            const scrollThreshold = 50;
            if (clientY < gridRect.top + scrollThreshold) scrollContainerRef.current.scrollTop -= 20;
            if (clientY > gridRect.bottom - scrollThreshold) scrollContainerRef.current.scrollTop += 20;
        };

        const handleDragEnd = () => {
            if (!draggedEvent) return;

            draggedEvent.element.style.opacity = '1';
            document.body.style.userSelect = '';

            let updates: DisplayEvent | null = null;
            if (dropIndicator) {
                const duration = new Date(draggedEvent.event.end).getTime() - new Date(draggedEvent.event.start).getTime();
                const newStart = dropIndicator.day;
                const newEnd = new Date(newStart.getTime() + duration);
                updates = { ...draggedEvent.event, start: newStart.toISOString(), end: newEnd.toISOString() };
            }

            const isRecurringVirtual = draggedEvent.event.is_recurring && draggedEvent.event.isVirtual;

            setDraggedEvent(null);
            setDropIndicator(null);

            if (updates) {
                if (isRecurringVirtual) {
                    setSelectedEvent(updates);
                    setModalOpen(true);
                } else {
                    const performSave = async () => {
                        setIsSaving(true);
                        try {
                            await handleSaveEvent(updates!, 'all');
                        } finally {
                            setIsSaving(false);
                        }
                    };
                    performSave();
                }
            }
        };

        if (draggedEvent) {
            window.addEventListener('mousemove', handleDragMove);
            window.addEventListener('touchmove', handleDragMove, { passive: false });
            window.addEventListener('mouseup', handleDragEnd);
            window.addEventListener('touchend', handleDragEnd);
        }

        return () => {
            window.removeEventListener('mousemove', handleDragMove);
            window.removeEventListener('touchmove', handleDragMove);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, [draggedEvent, dropIndicator, weekDays, handleSaveEvent]);
    
    // --- Resize Event ---
    const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>, event: DisplayEvent, direction: 'top' | 'bottom') => {
        e.preventDefault();
        e.stopPropagation();
        setResizingEvent({ event, direction });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingEvent || !scrollContainerRef.current || !headerRef.current) return;
    
            const { event, direction } = resizingEvent;
            document.body.style.cursor = 'ns-resize';
            
            const eventDay = new Date(event.start);
            const dayIndex = weekDays.findIndex(d => d.toDateString() === eventDay.toDateString());
            if (dayIndex === -1) return;
            
            const dayColumn = scrollContainerRef.current.querySelectorAll('.day-column')[dayIndex] as HTMLElement;
            if (!dayColumn) return;
    
            const gridRect = scrollContainerRef.current.getBoundingClientRect();
            const headerHeight = headerRef.current.offsetHeight;
            const scrollY = scrollContainerRef.current.scrollTop;
            const clientY = e.clientY;
            
            const rawY = clientY - gridRect.top - headerHeight + scrollY;
            const currentTime = yToTime(rawY, weekDays[dayIndex]);
            
            let newStart = new Date(event.start);
            let newEnd = new Date(event.end);
            
            if (direction === 'top') {
                newStart = currentTime;
            } else {
                newEnd = currentTime;
            }
    
            const minDuration = 15 * 60 * 1000;
            if (newEnd.getTime() - newStart.getTime() < minDuration) {
                if (direction === 'top') {
                    newStart.setTime(newEnd.getTime() - minDuration);
                } else {
                    newEnd.setTime(newStart.getTime() + minDuration);
                }
            }
            
            setDropIndicator({
                top: timeToY(newStart.toISOString()),
                left: dayColumn.offsetLeft,
                height: timeToY(newEnd.toISOString()) - timeToY(newStart.toISOString()),
                width: dayColumn.offsetWidth,
                day: newStart,
            });
        };
    
        const handleMouseUp = () => {
            document.body.style.cursor = 'default';
            if (!resizingEvent || !dropIndicator) {
                setResizingEvent(null);
                return;
            }
            
            const { event } = resizingEvent;
            const isRecurringVirtual = event.is_recurring && event.isVirtual;

            const eventDay = new Date(event.start);
            const dayIndex = weekDays.findIndex(d => d.toDateString() === eventDay.toDateString());
            
            setResizingEvent(null);
            setDropIndicator(null);

            if (dayIndex === -1) return;
    
            const newStart = yToTime(dropIndicator.top, weekDays[dayIndex]);
            const newEnd = yToTime(dropIndicator.top + dropIndicator.height, weekDays[dayIndex]);
            const updates = { ...event, start: newStart.toISOString(), end: newEnd.toISOString() };
            
            if (isRecurringVirtual) {
                setSelectedEvent(updates);
                setModalOpen(true);
            } else {
                const performSave = async () => {
                    setIsSaving(true);
                    try {
                        await handleSaveEvent(updates, 'all');
                    } finally {
                        setIsSaving(false);
                    }
                };
                performSave();
            }
        };
    
        if (resizingEvent) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
    
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            if (document.body.style.cursor === 'ns-resize') {
                document.body.style.cursor = 'default';
            }
        };
    }, [resizingEvent, weekDays, dropIndicator, handleSaveEvent]);

    const handleDayClick = (date: Date) => {
        setCurrentDate(date);
        setCalendarView('week');
    };

    const renderWeekView = () => (
        <div ref={scrollContainerRef} className="bg-white rounded-lg shadow-md select-none h-[calc(100vh-12rem)] overflow-y-auto relative">
            <div className={isSaving ? 'opacity-50 pointer-events-none' : ''}>
                <div ref={headerRef} className="sticky top-0 z-20 bg-white shadow-sm">
                    <div className="grid grid-cols-8">
                        <div className="p-2 border-r border-b w-14"></div>
                        {weekDays.map(day => (
                            <div key={day.toISOString()} className={`p-2 text-center border-r border-b font-semibold text-gray-700 md:text-base ${day.getDay() % 6 === 0 ? 'bg-blue-50' : ''}`}>
                                {day.toLocaleDateString(locale, { weekday: 'short' })} <br/> <span className="text-lg md:text-2xl">{day.getDate()}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-8 relative">
                    <div className="col-span-1 border-r relative">
                        {HOURS.map(hour => (
                            <div key={hour} className="h-[60px] text-right pr-2 text-sm md:text-base text-gray-500 border-b relative">
                                <span className="absolute -bottom-4 right-2 font-bold text-gray-800">
                                    {hour < 23 ? `${String(hour + 1).padStart(2, '0')}:00` : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                    {weekDays.map((day, dayIndex) => (
                        <div key={day.toISOString()} className={`day-column col-span-1 border-r relative ${day.getDay() % 6 === 0 ? 'bg-blue-50' : 'bg-white'}`}
                            onMouseDown={(e) => handleMouseDownOnGrid(e, dayIndex)}
                            onTouchStart={handleTouchStartOnGrid}
                            onTouchMove={handleTouchMoveOnGrid}
                            onTouchEnd={() => handleTouchEndOnGrid(dayIndex)}>
                            {HOURS.map(hour => <div key={hour} className="h-[60px] border-b"></div>)}
                            {allVisibleEvents.filter(event => {
                                    if (!event.start) return false;
                                    const d = new Date(event.start);
                                    if (isNaN(d.getTime())) return false;
                                    return d.toDateString() === day.toDateString();
                                })
                                .map(event => {
                                    const top = timeToY(event.start);
                                    const height = timeToY(event.end) - top;
                                    const bgColor = event.group_id ? 'bg-indigo-200 border-indigo-400' : 'bg-green-200 border-green-400';
                                    return (
                                        <div key={event.id}
                                            className={`absolute left-1 right-1 border rounded p-1 cursor-pointer z-10 event-item group ${bgColor} overflow-hidden flex flex-col`}
                                            style={{ top: `${top}px`, height: `${Math.max(20, height)}px` }}
                                            onMouseDown={(e) => handleDragStart(e, event)}
                                            onTouchStart={(e) => handleTouchDragStart(e, event)}
                                        >
                                            <div className="pointer-events-none flex-grow overflow-hidden">
                                                <p className="font-bold text-gray-800 text-xs md:text-sm leading-tight truncate">{event.title}</p>
                                            </div>
                                            <div className="pointer-events-none text-center pb-0.5">
                                                <p className="text-gray-600 text-xs md:text-sm whitespace-nowrap">
                                                    {new Date(event.start).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} - {new Date(event.end).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>

                                            {/* Resize Handles - Desktop only */}
                                            <div
                                                className="absolute top-[-4px] left-0 w-full h-[8px] cursor-ns-resize z-20 hidden group-hover:block"
                                                onMouseDown={(e) => handleResizeStart(e, event, 'top')}
                                            />
                                            <div
                                                className="absolute bottom-[-4px] left-0 w-full h-[8px] cursor-ns-resize z-20 hidden group-hover:block"
                                                onMouseDown={(e) => handleResizeStart(e, event, 'bottom')}
                                            />
                                        </div>
                                    );
                                })}
                        </div>
                    ))}
                    {dropIndicator && (
                        <div 
                            className="absolute bg-indigo-200 border-2 border-dashed border-indigo-500 rounded-lg z-20 pointer-events-none"
                            style={{
                                top: `${dropIndicator.top}px`,
                                left: `${dropIndicator.left}px`,
                                height: `${dropIndicator.height}px`,
                                width: `${dropIndicator.width}px`,
                            }}
                        />
                    )}
                    {selectionArea && (
                        <div
                            className="absolute bg-indigo-100 border border-indigo-300 opacity-70 z-10 pointer-events-none"
                            style={{
                                top: `${Math.min(selectionArea.startY, selectionArea.currentY)}px`,
                                height: `${Math.abs(selectionArea.currentY - selectionArea.startY)}px`,
                                left: `${(scrollContainerRef.current!.querySelector('.day-column') as HTMLElement).offsetLeft + selectionArea.dayIndex * (scrollContainerRef.current!.querySelector('.day-column') as HTMLElement).offsetWidth}px`,
                                width: `${(scrollContainerRef.current!.querySelector('.day-column') as HTMLElement).offsetWidth}px`
                            }}
                        />
                    )}
                </div>
            </div>
            {isSaving && (
                <div className="absolute inset-0 bg-white bg-opacity-75 z-30 flex justify-center items-center">
                    <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
            )}
        </div>
    );

    const renderMonthView = () => (
        <div className="bg-white rounded-lg shadow-md select-none hidden md:flex flex-col h-[calc(100vh-12rem)]">
            <div className="grid grid-cols-7 text-center font-semibold text-gray-700">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                    <div key={day} className="py-2 border-b md:text-lg">{day}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-6 flex-grow">
                {monthGrid.map(({ date, isCurrentMonth }, index) => {
                    const eventsOnDay = allVisibleEvents.filter(e => {
                        if (!e.start) return false;
                        const d = new Date(e.start);
                        if (isNaN(d.getTime())) return false;
                        return d.toDateString() === date.toDateString();
                    });
                    return (
                        <div 
                            key={index} 
                            className={`p-2 border-t border-l flex flex-col ${!isCurrentMonth ? 'bg-gray-50' : 'cursor-pointer hover:bg-indigo-50'}`}
                            onClick={() => handleDayClick(date)}
                        >
                            <span className={`font-medium md:font-bold md:text-lg ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-800'}`}>{date.getDate()}</span>
                            <div className="mt-1 space-y-1 overflow-y-auto">
                                {eventsOnDay.slice(0, 2).map(event => (
                                    <div key={event.id} className="text-xs md:text-sm bg-indigo-100 text-indigo-800 rounded px-1 truncate">
                                        {event.title}
                                    </div>
                                ))}
                                {eventsOnDay.length > 2 && (
                                    <div className="text-xs md:text-sm text-gray-500">+ {eventsOnDay.length - 2} еще</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

     const renderMobileMonthView = () => (
        <div className="bg-white rounded-lg shadow-md select-none md:hidden">
            <div className="grid grid-cols-7 text-center font-semibold text-gray-700">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                    <div key={day} className="py-2 border-b">{day}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-6">
                {monthGrid.map(({ date, isCurrentMonth }, index) => {
                    const eventsOnDay = allVisibleEvents.filter(e => {
                        if (!e.start) return false;
                        const d = new Date(e.start);
                        if (isNaN(d.getTime())) return false;
                        return d.toDateString() === date.toDateString();
                    });
                    return (
                        <div
                            key={index}
                            className={`p-2 border-t border-l h-28 flex flex-col ${!isCurrentMonth ? 'bg-gray-50' : 'cursor-pointer hover:bg-indigo-50'}`}
                            onClick={() => handleDayClick(date)}
                        >
                            <span className={`font-medium ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-800'}`}>{date.getDate()}</span>
                            <div className="mt-1 space-y-1 overflow-y-auto">
                                {eventsOnDay.slice(0, 2).map(event => (
                                    <div key={event.id} className="text-[10px] bg-indigo-100 text-indigo-800 rounded px-1 truncate">
                                        {event.title}
                                    </div>
                                ))}
                                {eventsOnDay.length > 2 && (
                                    <div className="text-[10px] text-gray-500">+ {eventsOnDay.length - 2} еще</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderYearView = () => {
        const year = currentDate.getFullYear();
        const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

        return (
            <div className="bg-white rounded-lg shadow-md p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {months.map(month => (
                        <div key={month.getMonth()} onClick={() => { setCurrentDate(month); setCalendarView('month'); }} className="p-4 text-center rounded-lg hover:bg-indigo-100 cursor-pointer">
                            <h3 className="font-semibold text-indigo-700 md:text-xl">{month.toLocaleString(locale, { month: 'long' })}</h3>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderCalendar = () => {
        if (calendarView === 'month') return <>{renderMonthView()}{renderMobileMonthView()}</>;
        if (calendarView === 'year') return renderYearView();
        return renderWeekView();
    };
    
    return (
        <div>
            {renderCalendar()}

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => { setModalOpen(false); setSelectedEvent(null); }} 
                title={selectedEvent?.id ? "Редактировать занятие" : "Новое занятие"}
            >
                <EventForm 
                    event={selectedEvent as DisplayEvent | null} 
                    onSave={handleSaveFromModal} 
                    onCancel={() => { setModalOpen(false); setSelectedEvent(null); }} 
                    onDelete={handleDeleteEvent} 
                    groups={groups} 
                />
            </Modal>
            
            <ConfirmationModal
                isOpen={!!eventToDelete}
                onClose={() => setEventToDelete(null)}
                onConfirm={executeDelete}
                title="Подтверждение удаления"
                message={ `Вы уверены, что хотите удалить ${eventToDelete?.scope === 'all' ? 'всю серию событий' : 'только это событие'} "${eventToDelete?.event.title}"?`}
                confirmText="Да, удалить"
            />
        </div>
    );
};

export default Schedule;