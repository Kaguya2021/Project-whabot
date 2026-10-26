const studentsBirthdays = [
    { fullName: 'Адылбекова Адинай', name: 'Адинай', dat: 'Адинай', gen: 'Адинай', date: '30.05' },
    { fullName: 'Айтыкеева Гулсун', name: 'Гулсун', dat: 'Гулсун', gen: 'Гулсун', date: '01.03' },
    { fullName: 'Ашымов Али', name: 'Али', dat: 'Али', gen: 'Али', date: '17.08' },
    { fullName: 'Багышбаев Динислам', name: 'Динислам', dat: 'Динисламу', gen: 'Динислама', date: '17.09' },
    { fullName: 'Баратов Эмир', name: 'Эмир', dat: 'Эмиру', gen: 'Эмира', date: '11.09' },
    { fullName: 'Бахтиярова Амина', name: 'Амина', dat: 'Амине', gen: 'Амину', date: '24.12' },
    { fullName: 'Беков Бэйэл', name: 'Бэйэл', dat: 'Бэйэлу', gen: 'Бэйэла', date: '23.12' },
    { fullName: 'Бектемирова Сауле', name: 'Сауле', dat: 'Сауле', gen: 'Сауле', date: '06.12' },
    { fullName: 'Бектенов Баяман', name: 'Баяман', dat: 'Баяману', gen: 'Баямана', date: '23.07' },
    { fullName: 'Джумабаев Нурэл', name: 'Нурэл', dat: 'Нурэлу', gen: 'Нурэла', date: '29.12' },
    { fullName: 'Дуйшобаева Элина', name: 'Элина', dat: 'Элине', gen: 'Элину', date: '07.11' },
    { fullName: 'Жакыпов Ибрахим', name: 'Ибрахим', dat: 'Ибрахиму', gen: 'Ибрахима', date: '02.10' },
    { fullName: 'Жолчубеков Байел', name: 'Байел', dat: 'Байелу', gen: 'Байела', date: '06.08' },
    { fullName: 'Жумаматова Саида', name: 'Саида', dat: 'Саиде', gen: 'Саиду', date: '18.02' },
    { fullName: 'Жусупова Альбина', name: 'Альбина', dat: 'Альбине', gen: 'Альбину', date: '26.08' },
    { fullName: 'Калыбеков Барсбек', name: 'Барсбек', dat: 'Барсбеку', gen: 'Барсбека', date: '04.11' },
    { fullName: 'Койчубекова Жаныл', name: 'Жаныл', dat: 'Жаныл', gen: 'Жаныл', date: '06.01' },
    { fullName: 'Кыдырбекова Айбийке', name: 'Айбийке', dat: 'Айбийке', gen: 'Айбийке', date: '09.11' },
    { fullName: 'Максатбекова Надиха', name: 'Надиха', dat: 'Надихе', gen: 'Надиху', date: '15.01' },
    { fullName: 'Мамадияров Элдос', name: 'Элдос', dat: 'Элдосу', gen: 'Элдоса', date: '17.05' },
    { fullName: 'Мамажанов Руслан', name: 'Руслан', dat: 'Руслану', gen: 'Руслана', date: '23.08' },
    { fullName: 'Мирланбеков Куттубек', name: 'Куттубек', dat: 'Куттубеку', gen: 'Куттубека', date: '26.07' },
    { fullName: 'Мунайбасова Сезим', name: 'Сезим', dat: 'Сезим', gen: 'Сезим', date: '01.09' },
    { fullName: 'Нурбекова Феруза', name: 'Феруза', dat: 'Ферузе', gen: 'Ферузу', date: '12.09' },
    { fullName: 'Сазанова Айдана', name: 'Айдана', dat: 'Айдане', gen: 'Айдану', date: '18.01' },
    { fullName: 'Суеркулова Раяна', name: 'Раяна', dat: 'Раяне', gen: 'Раяну', date: '06.08' },
    { fullName: 'Табылдыев Нурислам', name: 'Нурислам', dat: 'Нурисламу', gen: 'Нурислама', date: '17.05' },
    { fullName: 'Таласова Айдеми', name: 'Айдеми', dat: 'Айдеми', gen: 'Айдеми', date: '15.04' },
    { fullName: 'Тилеков Нурэл', name: 'Нурэл', dat: 'Нурэлу', gen: 'Нурэла', date: '18.03' },
    { fullName: 'Уланбекова Амина', name: 'Амина', dat: 'Амине', gen: 'Амину', date: '01.01' },
    { fullName: 'Умотбекова Айзирек', name: 'Айзирек', dat: 'Айзирек', gen: 'Айзирек', date: '07.08' },
    { fullName: 'Чолпонбаев Чынгыз', name: 'Чынгыз', dat: 'Чынгызу', gen: 'Чынгыза', date: '30.09' },
    { fullName: 'Шайлообеков Умар', name: 'Умар', dat: 'Умару', gen: 'Умара', date: '23.09' },
    { fullName: 'Эркинов Нурислам', name: 'Нурислам', dat: 'Нурисламу', gen: 'Нурислама', date: '07.09' }
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

    let found = studentsBirthdays.find(st => 
        st.fullName.toLowerCase() === q || 
        st.fullName.toLowerCase().includes(q)
    );

    if (!found) {
        found = studentsBirthdays.find(st => st.name.toLowerCase() === q);
    }

    if (!found) return null;

    // Возвращаем массив из двух строк для отправки двумя сообщениями
    const msg1 = `🎉 ${found.name}, с днём рождения! Желаем море позитива, океан счастья и ярких моментов. Пусть всё задуманное обязательно сбудется! ✨`;
    const msg2 = `💬 Ребята, давайте все вместе поздравим ${found.dat}!)`;

    return [msg1, msg2];
}

function checkBirthdayByDate(dateStr) {
    return studentsBirthdays.filter(st => st.date === dateStr);
}

module.exports = { getPeopleList, getBirthdayGreeting, checkBirthdayByDate, studentsBirthdays };
