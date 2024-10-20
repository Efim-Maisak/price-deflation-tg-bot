const fetch = require('node-fetch');
const { Markup, Scenes } = require('telegraf');
const {deleteMessages} = require('../services/deleteMessages');


const setDeflatorsScene = new Scenes.WizardScene('setDeflatorsWizard', (ctx) => {
      ctx.wizard.state.data = {};
      ctx.wizard.state.data.messageCounter = 0;
      ctx.reply('Введите все годы цен по порядку через пробел или дефис', Markup.keyboard(['/cancel']).oneTime().resize());
      ctx.wizard.state.data.messageCounter += 1;
      return ctx.wizard.next();
  },
  (ctx) => {
      if(ctx.message.text.match(/\d{4}[ |-]*/g)) {
            ctx.wizard.state.data.messageCounter += 1;
            ctx.wizard.state.data.yearsKit = ctx.message.text.split(/\-|\s+/);
            ctx.reply('Введите все дефляторы по порядку через пробел или дефис', Markup.keyboard(['/cancel']).oneTime().resize());
            ctx.wizard.state.data.messageCounter += 1;
            deleteMessages(ctx.wizard.state.data.messageCounter - 1, ctx);
            return ctx.wizard.next();
      } else {
            ctx.reply('Неверный ввод данных');
            deleteMessages(ctx.wizard.state.data.messageCounter - 1, ctx);
            return ctx.scene.leave();
      }
  },
  (ctx) => {
            if(ctx.message.text.match(/(?:0|[1-9]\d*[,.]\d+)[ -](?:0|[1-9]\d*[,.]\d+)[ -](?:0|[1-9]\d*[,.]\d+)(?:[ -](?:0|[1-9]\d*[,.]\d+))?(?:[ -](?:0|[1-9]\d*[,.]\d+))?(?:[ -](?:0|[1-9]\d*[,.]\d+))?/g)) {
                  ctx.wizard.state.data.messageCounter += 1;
                  ctx.message.text = ctx.message.text.replace(/(?=\d{3}[.,])\b10?/g, ''); //найти и удалить 1/10 у каждого дефлятора (вид пригодный для расчетов)
                  ctx.wizard.state.data.deflatorsKit = ctx.message.text.replace(/\,/g, '.').split(/\-|\s+/);

                  sendUserDeflators(mergeMessagesData(ctx.wizard.state.data.yearsKit, ctx.wizard.state.data.deflatorsKit), ctx);

                  ctx.reply(`
                  Вы изменили индексы дефляторы по умолчанию на:
${ctx.wizard.state.data.yearsKit.join(' | ')}
${ctx.wizard.state.data.deflatorsKit.map( item => item.concat('%')).join(' | ')}

Переключаться между дефляторами можно с помощью команды /toggle
                  `);
                  ctx.session.userCustomYears = [ String(parseInt(ctx.wizard.state.data.yearsKit[0]) - 1), ...ctx.wizard.state.data.yearsKit];
                  ctx.session.userCustomDeflators = [ '0', ...ctx.wizard.state.data.deflatorsKit];
                  ctx.wizard.state.data.messageCounter += 1;
                  deleteMessages(ctx.wizard.state.data.messageCounter - 1, ctx);
                  return ctx.scene.leave();
            } else {
            ctx.reply('Неверный ввод данных');
            deleteMessages(ctx.wizard.state.data.messageCounter - 1, ctx);
            return ctx.scene.leave();
            }
      }
);


setDeflatorsScene.hears('/cancel', async (ctx) => {
    deleteMessages(ctx.wizard.state.data.messageCounter, ctx);
    await ctx.scene.leave();
    ctx.reply('Ввод новых дефляторов отменен.');
  });


  function mergeMessagesData(years, deflators) {
      let resultArr = [];
      let yearsArrCopy = [];
      let deflatorsArrCopy = [];

      deflators.slice(0, years.length); // выравниваем длину массива дефляторов по длине массива лет

      if(years.length > 5) {
            yearsArrCopy = years.slice(0, 6);
      } else {
            yearsArrCopy = years;
      }

      if(deflators.length > 5) {
            deflatorsArrCopy = deflators.slice(0, 6);
      } else {
            deflatorsArrCopy = deflators;
      }

      if(deflatorsArrCopy.length < yearsArrCopy.length) {
            yearsArrCopy = yearsArrCopy.slice(0, deflatorsArrCopy.length);
      }

      for(let i = 0; i < yearsArrCopy.length; i++) {
            let cell = `${yearsArrCopy[i]}-${deflatorsArrCopy[i]}`;
            resultArr.push(cell);
      }
      return resultArr;
  }

  async function sendUserDeflators(mergedData, ctx) {
      ctx.session.userData = {
        isCustomDef: true,
        data1: mergedData[0],
        data2: mergedData[1] || '',
        data3: mergedData[2] || '',
        data4: mergedData[3] || '',
        data5: mergedData[4] || '',
        data6: mergedData[5] || ''
      };

      // получение номера строки и запись rowId в session
      try {
            let response = await fetch(`${process.env.DB_URL}/table/460/?user_field_names=true&filter__field_4170__equal=${ctx.message.from.id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Token ${process.env.DB_TOKEN}`
            },
          });

          let result = await response.json();

          ctx.session.userRowId = result.results[0].id;

      } catch(e) {
            new Error('Ошибка GET запроса к базе данных', e.message);
        }

      // запись пользовательских дефляторов в базу
      try {
            await fetch(`${process.env.DB_URL}/table/460/${ctx.session.userRowId}/?user_field_names=true`, {
                method: 'PATCH',
                headers: {
                  'Authorization': `Token ${process.env.DB_TOKEN}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(ctx.session.userData)
              });
        } catch(e) {
            new Error('Ошибка PATCH запроса к базе данных', e.message);
        }
  }


  module.exports = setDeflatorsScene;