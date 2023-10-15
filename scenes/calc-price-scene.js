const { Markup, Scenes } = require('telegraf');
const Big = require('big.js');
let basicYears = require('../bot');
let basicDeflators = require('../bot');
const {deleteMessages} = require('../services/deleteMessages');


let usedYears = [];
let usedDeflators = [];
let resultFinal = [];


const calcPriceScene = new Scenes.WizardScene('calcPriceWizard', (ctx) => {
    usedYears = [];
    usedDeflators = [];
    resultFinal = [];
    ctx.wizard.state.data = {};
    ctx.wizard.state.data.messageCounter = 0;
    ctx.reply('Введите год начальной цены', Markup.keyboard(['/cancel']).oneTime().resize());
    ctx.wizard.state.data.messageCounter += 1;
    return ctx.wizard.next();
  },
  (ctx) => {
    ctx.wizard.state.data.messageCounter += 1;
    ctx.wizard.state.data.yearAnswer = ctx.message.text;
    if(parseInt(ctx.wizard.state.data.yearAnswer) < parseInt(basicYears.basicYears[0]) || parseInt(ctx.wizard.state.data.yearAnswer) > parseInt(basicYears.basicYears[basicYears.basicYears.length - 2]) || isNaN(ctx.wizard.state.data.yearAnswer)) {
      deleteMessages(ctx.wizard.state.data.messageCounter - 1, ctx);
      ctx.reply('Вы ввели неправильный год начальной цены.');
      return ctx.scene.leave();
    } else {
      ctx.reply('Введите начальную цену', Markup.keyboard(['/cancel']).oneTime().resize());
      ctx.wizard.state.data.messageCounter += 1;
      return ctx.wizard.next();
    }
  },
  (ctx) => {
    ctx.wizard.state.data.messageCounter += 1;
    ctx.wizard.state.data.priceAnswer = ctx.message.text;
    if(Number(ctx.wizard.state.data.priceAnswer.replace(",", ".")) <= 0 || isNaN(ctx.wizard.state.data.priceAnswer.replace(",", "."))) {
      deleteMessages(ctx.wizard.state.data.messageCounter  - 1, ctx);
      ctx.reply('Вы ввели некорректное число.');
      return ctx.scene.leave();
    } else {
      checkUserDeflators(ctx).then(() => {
        if(ctx.session.isCustomDef) {
          // применить пользовательские дефляторы
          calcPrice(ctx.wizard.state.data.yearAnswer, ctx.wizard.state.data.priceAnswer, ctx.session.userCustomYears, ctx.session.userCustomDeflators);
          deleteMessages(ctx.wizard.state.data.messageCounter - 1, ctx);
          ctx.reply(`
      Вы ввели год: ${ctx.wizard.state.data.yearAnswer} и цену: ${ctx.wizard.state.data.priceAnswer.replace(".", ",")}\nРезультат:\n${createCalcResponse(resultFinal, usedYears, usedDeflators)}
      `, Markup.keyboard(['/calc']).resize());
        } else {
          // применить базовые дефляторы
          calcPrice(ctx.wizard.state.data.yearAnswer, ctx.wizard.state.data.priceAnswer, basicYears.basicYears, basicDeflators.basicDeflators);
          deleteMessages(ctx.wizard.state.data.messageCounter - 1, ctx);
          ctx.reply(`
      Вы ввели год: ${ctx.wizard.state.data.yearAnswer} и цену: ${ctx.wizard.state.data.priceAnswer.replace(".", ",")}\nРезультат:\n${createCalcResponse(resultFinal, usedYears, usedDeflators)}
      `, Markup.keyboard(['/calc']).resize());
        }
      });
    }
    return ctx.scene.leave();
  }
);


calcPriceScene.hears('/cancel', async (ctx) => {
  deleteMessages(ctx.wizard.state.data.messageCounter, ctx);
  await ctx.scene.leave();
  ctx.reply('Расчет отменен.');
});


function calcPrice(originalYear, originalPrice, years, deflators) {
  let yearIndex = years.indexOf(originalYear); // получаем индекс элемента исходного года (priceYear)
  let result = [];
  const priceBig = new Big(parseFloat(originalPrice.replace(",", ".")));

  if (yearIndex !== -1) {
    let semiResult = priceBig;
      for (let i = yearIndex + 1; i < years.length; i++) {
        if (priceBig !== semiResult) {
          try {
            // расчет дефлятора, если цена не равна промежуточному(или начальному) значению
            let semiResultIternal = new Big(semiResult);
            let divByHundred = semiResultIternal.div(100);
            let times = divByHundred.times(deflators[i]);
            let plused = semiResultIternal.plus(times);
            plused = Math.floor(plused * 100) / 100; // обрезать до двух знаков после запятой
            semiResult = plused;
            usedYears.push(years[i]);
            usedDeflators.push(String(deflators[i]).replace(".", ",").concat("%"));
            result.push(plused);
          } catch(e) {
            new Error('Ошибка вычислений');
          }

        } else {
          try {
            // расчет первого дефлятора
            let divByHundred = new Big(priceBig.div(100));
            let times = new Big(divByHundred.times(deflators[i]));
            let plused = new Big(priceBig.plus(times));
            semiResult = Math.floor(plused * 100) / 100; // обрезать до двух знаков после запятой
            usedYears.push(years[i]);
            usedDeflators.push(String(deflators[i]).replace(".", ",").concat("%"));
            result.push(semiResult);
          } catch(e) {
            new Error('Ошибка вычислений');
          }
        }
      }

      resultFinal = result.map( price => {
          return price.toLocaleString('ru-RU', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
      });

  }
}


function createCalcResponse(result, usedYearsArr, usedDeflatorsArr) {

  let resultArr = [];

  for(let i = 0; i < result.length; i++) {
    let lineArr = [];
    lineArr.push(usedYearsArr[i], usedDeflatorsArr[i], result[i]);
    const lineString = lineArr.join(' | ');
    resultArr.push(lineString);
  }


  return resultArr.join('\n');
}


async function checkUserDeflators(ctx) {

  ctx.session.dbDeflatorsData = {};

  try {
    let response = await fetch(`https://baserow.coldnaked.ru/api/database/rows/table/460/?user_field_names=true&filter__field_4170__equal=${ctx.message.from.id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${process.env.DB_TOKEN}`
    },
  });

  let result = await response.json();

  ctx.session.userRowId = result.results[0].id;

  if(result.results[0].isCustomDef) {

    ctx.session.dbDeflatorsData = {
      data1: result.results[0].data1 || "",
      data2: result.results[0].data2 || "",
      data3: result.results[0].data3 || "",
      data4: result.results[0].data4 || "",
      data5: result.results[0].data5 || "",
      data6: result.results[0].data6 || ""
    };

    let yearsArr = [];
    let deflatorsArr = [];

    let resultsArr = Object.values(ctx.session.dbDeflatorsData);
    let filteredArr = resultsArr.filter(item => item !== '');

    filteredArr.forEach(elem => {
      let subArr = [];
      subArr = elem.split('-');
      yearsArr.push(subArr[0]);
      deflatorsArr.push(subArr[1]);
    });

    ctx.session.userCustomYears = [ String(parseInt(yearsArr[0]) - 1), ...yearsArr] ;
    ctx.session.userCustomDeflators = [ '0', ...deflatorsArr];

    ctx.session.isCustomDef = true;
  } else {
    ctx.session.isCustomDef = false;
  }

  } catch(e) {
      new Error('Ошибка GET запроса к базе данных');
  }
}


module.exports = calcPriceScene;