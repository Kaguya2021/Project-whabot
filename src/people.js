const studentsBirthdays = [
    { fullName: 'Адылбекова Адинай', name: 'Адинай', date: '30.05' },
    { fullName: 'Айтыкеева Гулсун', name: 'Гулсун', date: '01.03' },
    { fullName: 'Ашымов Али', name: 'Али', date: '17.08' },
    { fullName: 'Багышбаев Динислам', name: 'Динислам', date: '17.09' },
    { fullName: 'Баратов Эмир', name: 'Эмир', date: '11.09' },
    { fullName: 'Бахтиярова Амина', name: 'Амина', date: '24.12' },
    { fullName: 'Беков Бэйэл', name: 'Бэйэл', date: '23.12' },
    { fullName: 'Бектемирова Сауле', name: 'Сауле', date: '06.12' },
    { fullName: 'Бектенов Баяман', name: 'Баяман', date: '23.07' },
    { fullName: 'Джумабаев Нурэл', name: 'Нурэл', date: '29.12' },
    { fullName: 'Дуйшобаева Элина', name: 'Элина', date: '07.11' },
    { fullName: 'Жакыпов Ибрахим', name: 'Ибрахим', date: '02.10' },
    { fullName: 'Жолчубеков Байел', name: 'Байел', date: '06.08' },
    { fullName: 'Жумаматова Саида', name: 'Саида', date: '18.02' },
    { fullName: 'Жусупова Альбина', name: 'Альбина', date: '26.08' },
    { fullName: 'Калыбеков Барсбек', name: 'Барсбек', date: '04.11' },
    { fullName: 'Койчубекова Жаныл', name: 'Жаныл', date: '06.01' },
    { fullName: 'Кыдырбекова Айбийке', name: 'Айбийке', date: '09.11' },
    { fullName: 'Максатбекова Надиха', name: 'Надиха', date: '15.01' },
    { fullName: 'Мамадияров Элдос', name: 'Элдос', date: '17.05' },
    { fullName: 'Мамажанов Руслан', name: 'Руслан', date: '23.08' },
    { fullName: 'Мирланбеков Куттубек', name: 'Куттубек', date: '26.07' },
    { fullName: 'Мунайбасова Сезим', name: 'Сезим', date: '01.09' },
    { fullName: 'Нурбекова Феруза', name: 'Феруза', date: '12.09' },
    { fullName: 'Сазанова Айдана', name: 'Айдана', date: '18.01' },
    { fullName: 'Суеркулова Раяна', name: 'Раяна', date: '06.08' },
    { fullName: 'Табылдыев Нурислам', name: 'Нурислам', date: '17.05' },
    { fullName: 'Таласова Айдеми', name: 'Айдеми', date: '15.04' },
    { fullName: 'Тилеков Нурэл', name: 'Нурэл', date: '18.03' },
    { fullName: 'Уланбекова Амина', name: 'Амина', date: '01.01' },
    { fullName: 'Умотбекова Айзирек', name: 'Айзирек', date: '07.08' },
    { fullName: 'Чолпонбаев Чынгыз', name: 'Чынгыз', date: '30.09' },
    { fullName: 'Шайлообеков Умар', name: 'Умар', date: '23.09' },
    { fullName: 'Эркинов Нурислам', name: 'Нурислам', date: '07.09' }
];

function getPeopleList() {
    let response = `👥 9-В класс\n№104 ЖББ мектеби\n\n`;
    studentsBirthdays.forEach((st, index) => {
        response += `${index + 1}. ${st.fullName}\n`;
    });
    return response.trim();
}

function getBirthdayGreeting(query) {
    if (!query) return null;
    const q = query.toLowerCase().trim();

    // Точный поиск с учетом фамилии или имени для тезок
    let found = studentsBirthdays.find(st => 
        st.fullName.toLowerCase() === q || 
        st.fullName.toLowerCase().includes(q)
    );

    if (!found) {
        found = studentsBirthdays.find(st => st.name.toLowerCase() === q);
    }

    if (!found) return null;

    return `${found.name}, с днём рождения! Желаю море позитива, океан любви и целую вселенную счастья. Пусть всё задуманное обязательно сбудется!\n\nРебята давайте всем вместе поздравив ${found.name}`;
}

function checkBirthdayByDate(dateStr) {
    return studentsBirthdays.filter(st => st.date === dateStr);
}

module.exports = { getPeopleList, getBirthdayGreeting, checkBirthdayByDate, studentsBirthdays };
