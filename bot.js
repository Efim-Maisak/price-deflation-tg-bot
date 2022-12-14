require('dotenv').config();

const { Telegraf, Markup, Scenes, session, Composer } = require('telegraf');

const calcPriceScene = require('./scenes/calc-price-scene');
const setDeflatorsScene = require('./scenes/set-deflators-scene');

const bot = new Telegraf(process.env.BOT_TOKEN);


const stage = new Scenes.Stage([calcPriceScene, setDeflatorsScene]);
bot.use(session());
bot.use(stage.middleware());


// Базовые константы
const basicYears = ["2020","2021", "2022", "2023", "2024", "2025"];
const basicDeflators = [0, 21.8, 12.9, 4.5, 4.3, 3.9];


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
    await ctx.scene.enter('setDeflatorsWizard');
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

    if(!ctx.session.userCustomYears || !ctx.session.userCustomDeflators) {
      ctx.replyWithHTML(`
<b>Справка:</b>

Индексы дефляторы по умолчанию (Раздел C "Обрабатывающие производства")
на основании Письма Минэкономразвития РФ № 36804-ПК от 28.09.2022:

${basicYearsCopy.splice(1, 5).join(' | ')}
${basicDeflatorsCopy.splice(1, 5).map( item => String(item).concat('%')).join(' | ')}

Пользовательские дефляторы не определены.

&#9888 Команды:

/calc - Произвести расчет цен;
/set - Установить пользовательские дефляторы;
/cancel - Завершить диалог ввода данных.
/toggle - Переключить набор дефляторов с пользовательского на базовый и наоборот.

&#8505 Вы можете ввести пользовательские дефляторы в бот для дальнейшего использования или использовать базовые.
      `);
    } else {
      ctx.replyWithHTML(`
<b>Справка:</b>

Индексы дефляторы по умолчанию (Раздел C "Обрабатывающие производства")
на основании Письма Минэкономразвития РФ № 36804-ПК от 28.09.2022:

${basicYearsCopy.splice(1, 5).join(' | ')}
${basicDeflatorsCopy.splice(1, 5).map( item => String(item).concat('%')).join(' | ')}

Пользовательские дефляторы:

${ctx.session.userCustomYears.splice(1).join(' | ')}
${ctx.session.userCustomDeflators.splice(1).map( item => item.concat('%')).join(' | ')}

&#9888 Команды:

/calc - Произвести расчет цен;
/set - Установить пользовательские дефляторы;
/cancel - Завершить диалог ввода данных.
/toggle - Переключить набор дефляторов с пользовательского на базовый и наоборот.

&#8505 Вы можете ввести пользовательские дефляторы в бот для дальнейшего использования или использовать базовые.
      `);
    }
});


//calc
bot.command('calc', async (ctx) => {
    await ctx.scene.enter('calcPriceWizard');
});


// set
bot.command('set', async (ctx) => {
  await ctx.scene.enter('setDeflatorsWizard');
});


// toggle
bot.command('toggle', async (ctx) => {

  try {
    let response = await fetch(`https://baserow.coldnaked.ru/api/database/rows/table/460/?user_field_names=true&filter__field_4170__equal=${ctx.message.from.id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${process.env.DB_TOKEN}`
    },
  });

  let result = await response.json();

  ctx.session.userRowId = result.results[0].id;
  ctx.session.isCustomDef = result.results[0].isCustomDef;

  } catch(e) {
      new Error('Ошибка GET запроса к базе данных');
  }


  if (ctx.session.isCustomDef) {

    const toggleData = {
      isCustomDef: false
    };

    try {
      await fetch(`https://baserow.coldnaked.ru/api/database/rows/table/460/${ctx.session.userRowId}/?user_field_names=true`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Token ${process.env.DB_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(toggleData)
        });
  } catch(e) {
      new Error('Ошибка PATCH запроса к базе данных');
  }

  ctx.session.isCustomDef = false;
  ctx.reply('Выбраны базовые индексы дефляторы');

  } else {
    const toggleData = {
      isCustomDef: true
    };

    try {
      await fetch(`https://baserow.coldnaked.ru/api/database/rows/table/460/${ctx.session.userRowId}/?user_field_names=true`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Token ${process.env.DB_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(toggleData)
        });
  } catch(e) {
      new Error('Ошибка PATCH запроса к базе данных');
  }

  ctx.session.isCustomDef = true;
  ctx.reply('Выбраны пользовательские индексы дефляторы');
  }

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