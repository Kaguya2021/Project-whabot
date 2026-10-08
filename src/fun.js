const baranFacts = [
    'Бараны обладают отличной панорамной памятью и могут узнавать лица людей и других баранов до нескольких лет.',
    'Угол обзора глаз барана составляет от 270 до 320 градусов, что позволяет им видеть происходящее сзади, не поворачивая головы.',
    'Бараны - социальные животные. Если баран остается один, он испытывает сильный стресс.',
    'Зрачки у баранов прямоугольной формы, что дает им лучшее периферийное зрение.',
    'Бараны способны чувствовать эмоциональное состояние друг друга и подстраивать свое поведение.'
];

const fakeNewsTemplates = [
    'СРОЧНЫЕ НОВОСТИ: {user} официально объявлен главным экспертом по прогулам уроков!',
    'ЭКСТРЕННЫЙ ВЫПУСК: {user} случайно выиграл чемпионат мира по поеданию бананов!',
    'НОВОСТИ ДНЯ: {user} открыл секретный закон физики, позволяющий спать на уроках и всё понимать.'
];

function getBananaResponse(targetUser) {
    const userStr = targetUser ? targetUser : 'цели';
    return `Межконтинентальная банан-ракета вылетела в сторону ${userStr}! Точные координаты зафиксированы ;)`;
}

function getNewsResponse(targetUser) {
    const userStr = targetUser ? targetUser : 'неизвестного героя';
    const randomNews = fakeNewsTemplates[Math.floor(Math.random() * fakeNewsTemplates.length)];
    return randomNews.replace('{user}', userStr);
}

function getPalcResponse() {
    return 'байчик зайчик засунул в popy пальчик ;)';
}

function getRandomBaranFact() {
    const randomIndex = Math.floor(Math.random() * baranFacts.length);
    return `Факт о баранах:\n${baranFacts[randomIndex]}`;
}

module.exports = {
    getBananaResponse,
    getNewsResponse,
    getPalcResponse,
    getRandomBaranFact
};
