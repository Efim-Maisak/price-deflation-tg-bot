require('dotenv').config();

const { Telegraf, Markup, Scenes, session, Composer } = require('telegraf');

const { calcPriceScene } = require('./scenes/calc-price-scene');

const bot = new Telegraf(process.env.BOT_TOKEN);


const stage = new Scenes.Stage([calcPriceScene]);
bot.use(session());
bot.use(stage.middleware());


// Базовые константы
const basicYears = ["2019","2020", "2021", "2022", "2023", "2024"];
const basicDeflators = [0, 0.4, 20.3, 3.9, 3.2, 3.7];


// start
bot.start((ctx) => {
//  здесь будет код записи юзера в базу.

ctx.replyWithHTML(`
<b>Приветствую, ${ctx.message.from.first_name}!</b>
Добро пожаловать в бот для расчета цен по индексам-дефляторам.

<i>Вы можете ввести пользовательские дефляторы в бот для дальнейшего использования или использовать базовые.</i>
`, Markup.inlineKeyboard(
    [
        [Markup.button.callback('Ввести новые дефляторы', 'newDeflators')],
        [Markup.button.callback('Расчитать цену', 'calcPrice')]
    ]
));
});


bot.action('newDeflators', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('Данная функция в настоящее время недоступна');
});


bot.action('calcPrice', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter('calcPriceWizard');
    }
);


// help
bot.help((ctx) => ctx.replyWithHTML(`
<b>Справка</b>
Базовые дефляторы:
${basicYears.splice(1, 5).join(' | ')}
${basicDeflators.splice(1, 5).map( item => String(item).concat('%')).join(' | ')}

Команды:
/calc - Произвести расчет цен;
/set - Установить пользовательские дефляторы.
/cancel - Закончить диалог ввода года и цены.
`));


//calc
bot.command('calc', async (ctx) => {
    await ctx.scene.enter('calcPriceWizard');
});


bot.launch();

module.exports.basicYears = basicYears;
module.exports.basicDeflators = basicDeflators;