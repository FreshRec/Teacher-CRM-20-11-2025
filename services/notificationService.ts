import { Student, Payment, Lesson } from "../types";

const locale = 'ru-RU';

export const notificationService = {
    sendPaymentReminder: (student: Student, payment: Payment) => {
        const subject = "Напоминание о предстоящей оплате";
        const body = `Уважаемый/ая ${student.parent_name},\n\nНапоминаем, что оплата в размере ${payment.amount}₽ должна быть произведена до ${new Date(payment.dueDate).toLocaleDateString(locale)}.\n\nС уважением,\nВаш учитель английского`;
        console.log(`[Email Sent] To: ${student.parent_email}, Subject: ${subject}\nBody: ${body}`);
    },

    sendScheduleChange: (student: Student, lesson: Lesson, oldDate?: string, oldTime?: string) => {
        const subject = "Изменение в расписании занятий";
        const oldDateTime = oldDate && oldTime ? ` с ${new Date(oldDate).toLocaleDateString(locale)} в ${oldTime}` : '';
        const body = `Уважаемый/ая ${student.parent_name},\n\nПожалуйста, обратите внимание на изменение в расписании у ${student.name}. Урок по теме "${lesson.topic}" перенесен${oldDateTime} на ${new Date(lesson.date).toLocaleDateString(locale)} в ${lesson.time}.\n\nС уважением,\nВаш учитель английского`;
        console.log(`[Email Sent] To: ${student.parent_email}, Subject: ${subject}\nBody: ${body}`);
    },

    sendWelcomeEmail: (student: Student) => {
        const subject = `Добро пожаловать на занятия по английскому, ${student.name}!`;
        const body = `Уважаемый/ая ${student.parent_name},\n\nМы очень рады, что ${student.name} присоединился/ась к занятиям по английскому! Впереди нас ждет продуктивный год.\n\nС уважением,\nВаш учитель английского`;
        console.log(`[Email Sent] To: ${student.parent_email}, Subject: ${subject}\nBody: ${body}`);
    }
};