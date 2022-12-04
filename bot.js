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

checkUser(ctx);

ctx.replyWithHTML(`
<b>Приветствую, ${ctx.message.from.first_name}!</b>
Добро пожаловать в бот для расчета цен по индексам-дефляторам.

Посмотреть справку /help

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
bot.help((ctx) => {
    let basicYearsCopy = basicYears.slice();
    let basicDeflatorsCopy = basicDeflators.slice();
    ctx.replyWithHTML(`
<b>Справка:</b>

Базовые дефляторы:
${basicYearsCopy.splice(1, 5).join(' | ')}
${basicDeflatorsCopy.splice(1, 5).map( item => String(item).concat('%')).join(' | ')}

Команды:
/calc - Произвести расчет цен;
/set - Установить пользовательские дефляторы;
/cancel - Закончить диалог ввода года и цены.

Вы можете ввести пользовательские дефляторы в бот для дальнейшего использования или использовать базовые.
`);
});


//calc
bot.command('calc', async (ctx) => {
    await ctx.scene.enter('calcPriceWizard');
});


// set
bot.command('set', async (ctx) => {
    await ctx.reply('Данная функция в настоящее время недоступна');
});



async function checkUser(ctx) {
    ctx.session.userData = {
        userId: ctx.message.from.id,
        userFirstName: ctx.message.from.first_name,
        userName: ctx.message.from.username
    };

    try {
        let response = await fetch(`https://baserow.coldnaked.ru/api/database/rows/table/460/?user_field_names=true&filter__field_4170__equal=${ctx.session.userData.userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${process.env.DB_TOKEN}`
        },
      });

      let result = await response.json();
      let checkedUser = result.count;

      if (result.results.length == 0) {
        ctx.session.userRowId = 0;
      } else {
        ctx.session.userRowId = result.results[0].id;
      }

      if(checkedUser == 0) {
        try {
            await fetch('https://baserow.coldnaked.ru/api/database/rows/table/460/?user_field_names=true', {
                method: 'POST',
                headers: {
                  'Authorization': `Token ${process.env.DB_TOKEN}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(ctx.session.userData)
            });
        } catch(e) {
            new Error('Ошибка POST запроса к базе данных');
        }
      } else {
        let userDataPatching = JSON.parse(JSON.stringify(ctx.session.userData));
        delete userDataPatching.userId;
        try {
            await fetch(`https://baserow.coldnaked.ru/api/database/rows/table/460/${ctx.session.userRowId}/?user_field_names=true`, {
                method: 'PATCH',
                headers: {
                  'Authorization': `Token ${process.env.DB_TOKEN}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(userDataPatching)
              });
        } catch(e) {
            new Error('Ошибка PATCH запроса к базе данных');
        }
      }
    } catch(e) {
        new Error('Ошибка GET запроса к базе данных');
    }
}



bot.launch();

module.exports.basicYears = basicYears;
module.exports.basicDeflators = basicDeflators;