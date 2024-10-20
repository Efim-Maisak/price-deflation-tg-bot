require('dotenv').config();
const { Telegraf, Markup, Scenes, session } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

let baseData = {
  basis: "",
  basicYears: [],
  basicDeflators: []
};

async function getBaseDeflators() {
  try {
    const res = await fetch(`${process.env.DB_URL}/table/1427/?user_field_names=true`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${process.env.DB_TOKEN}`
      },
    });

    const result = await res.json();
    const data = result.results[0];

    if (data.basis) {
      baseData.basis = data.basis;
    }

    if (data.deflator1 && data.deflator2 && data.deflator3 && data.deflator4 && data.deflator5) {
      baseData.basicYears = [
        String(Number(data.deflator1.split("-")[0]) - 1),
        data.deflator1.split("-")[0],
        data.deflator2.split("-")[0],
        data.deflator3.split("-")[0],
        data.deflator4.split("-")[0],
        data.deflator5.split("-")[0]
      ];

      baseData.basicDeflators = [
        0,
        parseFloat(data.deflator1.split("-")[1].replace(",", ".")),
        parseFloat(data.deflator2.split("-")[1].replace(",", ".")),
        parseFloat(data.deflator3.split("-")[1].replace(",", ".")),
        parseFloat(data.deflator4.split("-")[1].replace(",", ".")),
        parseFloat(data.deflator5.split("-")[1].replace(",", "."))
      ];
    }
  } catch (e) {
    console.error('Ошибка получения базовых дефляторов', e.message);
  }
}

// Инициализация бота
async function initBot() {
  await getBaseDeflators();

  const calcPriceScene = require('./scenes/calc-price-scene');
  const setDeflatorsScene = require('./scenes/set-deflators-scene');

  const stage = new Scenes.Stage([calcPriceScene, setDeflatorsScene]);

  bot.use(session());
  bot.use(stage.middleware());

  bot.use(async (ctx, next) => {
    if (!ctx.session.baseData) {
      ctx.session.baseData = { ...baseData };
    }
    await next();
  });

  // Команда /start
  bot.start(async (ctx) => {

    await checkUser(ctx);

    ctx.replyWithHTML(`
  <b>Приветствую, ${ctx.message.from.first_name}!</b>
  Добро пожаловать в бот для расчета цен по индексам-дефляторам.

  Посмотреть справку /help

  <i>Вы можете ввести пользовательские дефляторы в бот для дальнейшего использования или использовать дефляторы по умолчанию.</i>
      `, Markup.inlineKeyboard([
        [Markup.button.callback('Ввести новые дефляторы', 'newDeflators')],
        [Markup.button.callback('Расчитать цену', 'calcPrice')]
      ]));
    });

  // Обработчики действий
  bot.action('newDeflators', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter('setDeflatorsWizard');
  });

  bot.action('calcPrice', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.scene.enter('calcPriceWizard');
  });

  // Команда /help
  bot.help((ctx) => {
    const { basis, basicYears, basicDeflators } = ctx.session.baseData;
    let basicYearsCopy = basicYears.slice();
    let basicDeflatorsCopy = basicDeflators.slice();

    let helpText = `
  <b>Справка:</b>

Индексы дефляторы по умолчанию (Раздел C "Обрабатывающие производства")
${basis}:

${basicYearsCopy.slice(1, 6).join(' | ')}
${basicDeflatorsCopy.slice(1, 6).map(item => String(item).concat('%')).join(' | ')}

`;

  if (ctx.session.userCustomYears && ctx.session.userCustomDeflators) {
  helpText += `
Пользовательские дефляторы:

${ctx.session.userCustomYears.slice(1).join(' | ')}
${ctx.session.userCustomDeflators.slice(1).map(item => String(item).concat('%')).join(' | ')}
  `;
  } else {
    helpText += `
Пользовательские дефляторы не определены.
  `;
}

  helpText += `
&#9888 Команды:

/calc - Произвести расчет цен;
/set - Установить пользовательские дефляторы;
/cancel - Завершить диалог ввода данных;
/toggle - Переключить набор дефляторов с пользовательского на базовый и наоборот.

&#8505 Вы можете ввести пользовательские дефляторы в бот или использовать индексы дефляторы по умолчанию.
`;

  ctx.replyWithHTML(helpText);
  });

  // Команда /calc
  bot.command('calc', async (ctx) => {
    await ctx.scene.enter('calcPriceWizard');
  });

  // Команда /set
  bot.command('set', async (ctx) => {
    await ctx.scene.enter('setDeflatorsWizard');
  });

  // Команда /toggle
  bot.command('toggle', async (ctx) => {
    try {
      let response = await fetch(`${process.env.DB_URL}/table/460/?user_field_names=true&filter__field_4170__equal=${ctx.message.from.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${process.env.DB_TOKEN}`
        },
      });

      let result = await response.json();

      ctx.session.userRowId = result.results[0].id;
      ctx.session.isCustomDef = result.results[0].isCustomDef;

      const toggleData = {
        isCustomDef: !ctx.session.isCustomDef
      };

      await fetch(`${process.env.DB_URL}/table/460/${ctx.session.userRowId}/?user_field_names=true`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${process.env.DB_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(toggleData)
      });

      ctx.session.isCustomDef = toggleData.isCustomDef;
      ctx.reply(toggleData.isCustomDef ? 'Выбраны пользовательские индексы дефляторы' : 'Выбраны индексы дефляторы по умолчанию');

    } catch (e) {
      console.error('Ошибка при выполнении запроса к базе данных', e.message);
      ctx.reply('Произошла ошибка при изменении настроек. Пожалуйста, попробуйте позже.');
    }
  });

  bot.launch();
}

// Функция проверки и записи пользователя в БД
async function checkUser(ctx) {
  ctx.session.userData = {
    userId: ctx.message.from.id,
    userFirstName: ctx.message.from.first_name,
    userName: ctx.message.from.username
  };

  try {
    let response = await fetch(`${process.env.DB_URL}/table/460/?user_field_names=true&filter__field_4170__equal=${ctx.session.userData.userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${process.env.DB_TOKEN}`
      },
    });

    let result = await response.json();
    let checkedUser = result.count;

    ctx.session.userRowId = result.results.length === 0 ? 0 : result.results[0].id;

    if (checkedUser === 0) {
      await fetch(`${process.env.DB_URL}/table/460/?user_field_names=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${process.env.DB_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ctx.session.userData)
      });
    } else {
      let userDataPatching = { ...ctx.session.userData };
      delete userDataPatching.userId;
      await fetch(`${process.env.DB_URL}/table/460/${ctx.session.userRowId}/?user_field_names=true`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${process.env.DB_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userDataPatching)
      });
    }
  } catch (e) {
    console.error('Ошибка при выполнении запроса к базе данных', e.message);
  }
}

initBot();

module.exports = {
  bot,
  baseData
};