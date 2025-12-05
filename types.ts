
export type View = 'dashboard' | 'students' | 'journal' | 'groups' | 'subscriptions' | 'schedule' | 'finance' | 'archive' | 'studentFinance' | 'admin';

export interface UserPermissions {
    canViewDashboard: boolean;
    canViewStudents: boolean;
    canViewJournal: boolean;
    canViewGroups: boolean;
    canViewSubscriptions: boolean;
    canViewSchedule: boolean;
    canViewFinance: boolean;
    canViewArchive: boolean;
    canManageUsers: boolean;
}

export interface UserProfile {
    id: string;
    email: string;
    role: 'admin' | 'teacher';
    permissions: UserPermissions;
}

export interface Student {
  id: string;
  name: string;
  birth_date: string | null;
  parent_name: string;
  parent_phone1: string;
  parent_phone2?: string;
  parent_email?: string;
  balance: number;
  status: 'active' | 'archived';
  archived_date?: string | null;
  group_ids: string[];
  // These are joined from other tables
  subscriptions?: StudentSubscription[];
  transactions?: FinancialTransaction[];
}

export type StudentForCreation = Omit<Student, 'id' | 'subscriptions' | 'transactions'>;

export interface Group {
    id: string;
    name: string;
}

export type GroupForCreation = Omit<Group, 'id'>;

export interface SubscriptionPlan {
    id: string;
    name: string;
    price: number;
    discount: number;
    lesson_count: number;
    is_default?: boolean;
}

export type SubscriptionPlanForCreation = Omit<SubscriptionPlan, 'id'>;

export interface StudentSubscription {
    id: string;
    student_id: string;
    subscription_plan_id: string;
    purchase_date: string;
    price_paid: number;
    lessons_total: number;
    lessons_attended: number;
    assigned_group_id: string | null;
}

export type StudentSubscriptionForCreation = Omit<StudentSubscription, 'id' | 'purchase_date' | 'lessons_attended'>;

export interface FinancialTransaction {
    id: string;
    student_id: string;
    date: string;
    type: 'payment' | 'refund' | 'correction' | 'debit';
    amount: number;
    description: string;
    student_subscription_id?: string | null;
}

export type FinancialTransactionForCreation = Omit<FinancialTransaction, 'id' | 'date'>;

export interface Attendance {
    student_id: string;
    date: string; // YYYY-MM-DD
    status: 'present' | 'absent' | 'excused';
    grade?: number | null; // Allow null for grade
    student_subscription_id?: string | null;
}

export type AttendanceForCreation = Attendance;

export interface ScheduleEvent {
    id: string;
    title: string;
    group_id?: string | null;
    start: string; // ISO 8601
    end: string; // ISO 8601
    is_recurring: boolean;
}

export type ScheduleEventForCreation = Omit<ScheduleEvent, 'id'>;

export interface ScheduleEventException {
    original_event_id: string;
    original_start_time: string; // The specific occurrence key this exception applies to
    new_title?: string;
    new_group_id?: string | null;
    new_start_time?: string;
    new_end_time?: string;
    is_deleted?: boolean;
}

export type ScheduleEventExceptionForCreation = Omit<ScheduleEventException, 'original_start_time'> & { original_start_time: string };

export interface Expense {
    id: string;
    date: string; // ISO 8601
    description: string;
    amount: number;
}

export type ExpenseForCreation = {
    date?: string; // Optional date
    description: string;
    amount: number;
};

// This is a new type representing a displayable event, which can be an original, a recurrence, or an exception.
export type DisplayEvent = ScheduleEvent & {
    originalId: string; // The ID of the root recurring event
    isVirtual: boolean; // Is it a generated recurrence?
    occurrence_key: string; // The stable, timezone-agnostic key for this specific occurrence
    exception?: ScheduleEventException; // Is it modified by an exception?
};


// from notificationService, not stored in DB
export interface Payment {
    amount: number;
    dueDate: string;
}

export interface Lesson {
    topic: string;
    date: string;
    time: string;
}

export interface IAppContext {
    userProfile: UserProfile | null;
    students: Student[];
    groups: Group[];
    subscriptionPlans: SubscriptionPlan[];
    attendance: Attendance[];
    transactions: FinancialTransaction[];
    scheduleEvents: ScheduleEvent[];
    eventExceptions: ScheduleEventException[];
    allVisibleEvents: DisplayEvent[];
    expenses: Expense[];
    allProfiles: UserProfile[]; // For admin view
    notifications: { id: number; message: string; type: 'success' | 'error' }[];
    isLoading: boolean;
    isSaving: boolean;
    showNotification: (message: string, type?: 'success' | 'error') => void;
    addStudent: (student: StudentForCreation) => Promise<Student | null>;
    addStudents: (students: StudentForCreation[]) => Promise<Student[] | null>;
    updateStudent: (id: string, updates: Partial<Student>) => Promise<Student | null>;
    deleteStudents: (ids: string[]) => Promise<boolean>;
    addGroup: (group: GroupForCreation) => Promise<Group | null>;
    updateGroup: (id: string, updates: Partial<Group>) => Promise<Group | null>;
    deleteGroup: (id: string) => Promise<boolean>;
    addSubscriptionPlan: (plan: SubscriptionPlanForCreation) => Promise<SubscriptionPlan | null>;
    updateSubscriptionPlan: (id: string, updates: Partial<SubscriptionPlan>) => Promise<SubscriptionPlan | null>;
    deleteSubscriptionPlan: (id: string) => Promise<boolean>;
    addStudentSubscription: (sub: StudentSubscriptionForCreation) => Promise<StudentSubscription | null>;
    updateStudentSubscription: (id: string, updates: Partial<StudentSubscription>) => Promise<StudentSubscription | null>;
    refundToBalanceAndCancelSubscription: (subscriptionId: string) => Promise<void>;
    processCashRefundAndCancelSubscription: (subscriptionId: string) => Promise<void>;
    addTransaction: (transaction: FinancialTransactionForCreation) => Promise<FinancialTransaction | null>;
    setAttendanceRecord: (record: AttendanceForCreation, groupId: string) => Promise<void>;
    deleteAttendanceRecord: (studentId: string, date: string) => Promise<void>;
    addScheduleEvent: (event: ScheduleEventForCreation) => Promise<ScheduleEvent | null>;
    updateScheduleEvent: (id: string, updates: Partial<ScheduleEvent>) => Promise<ScheduleEvent | null>;
    deleteScheduleEvent: (id: string) => Promise<boolean>;
    addEventException: (exception: ScheduleEventException) => Promise<ScheduleEventException | null>;
    addExpense: (expense: ExpenseForCreation) => Promise<Expense | null>;
    updateExpense: (id: string, updates: Partial<Omit<Expense, 'id'>>) => Promise<Expense | null>;
    deleteExpense: (id: string) => Promise<boolean>;
    clearStudentFinancialData: () => Promise<void>;
    updateUserProfile: (id: string, updates: Partial<UserProfile>) => Promise<void>;
    seedDatabase: () => Promise<void>;
}
