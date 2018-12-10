'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const Slack = require('node-slackr');
const cron = require('node-cron');
let settings = undefined;
if (!process.env.TARGET_URL) {
  settings = require('./settings');
} else {
  settings = {
    target: {
      url: process.env.TARGET_URL,
      excludeWord: process.env.EXCLUDE_WORD
    },
    slack: {
      webhookURL: process.env.WEBHOOK_URL,
      slackChannel: process.env.SLACK_CHANNEL
    }
  }
}
const excludeWord = new RegExp(settings.target.excludeWord); 
const filePath = path.join(__dirname, 'items.json');

const postSlack = ((newItems) => {
  const attachments = [];
  for (const newItem of newItems) {
    const fields = [];
    const field = {
      title: newItem.title,
      value: newItem.price + '\n<https://item.mercari.com/jp/' + newItem.id + '/>'
    };
    fields.push(field);
    const attachment = {
      fields: fields,
      image_url: newItem.src
    };
    attachments.push(attachment);
  }
  const slack = new Slack(settings.slack.webhookURL);
  const slackMessage = {
    channel: settings.slack.slackChannel,
    username: 'メルカリチェッカー',
    text: '新着アイテム',
    attachments: attachments
  };
  slack.notify(slackMessage, (error, result) => {
    if (error) {
      console.log(error);
    } else {
      console.log(result);
    }
  });
});

cron.schedule('* * * * *', () => {
  fs.readFile(filePath, (error, result) => {
    if (error) {
      console.log('error: ' + filePath + ' の読み込みに失敗');
      const content = JSON.stringify([]);
      fs.writeFile(filePath, content, (error) => {
        if (error) {
          console.log('error: ファイル書き込みエラーです');
        } else {
          console.log('success: ' + filePath + ' を新規作成');
        }
      });
    } else {
      console.log('success: ' + filePath + ' の読み込みに成功');
      const items = JSON.parse(result);
  
      const oldItemsId = [];
      for (const item of items) {
        oldItemsId.push(item.id);
      }
  
      (async () => {
        const newItems = [];
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(settings.target.url);
        await page.waitForSelector('body > div > main > div.l-content');
        const itemBlocks = await page.$$('body > div > main > div.l-content > section > div > section > a');
        for (const itemBlock of itemBlocks) {
          const imgTag = await itemBlock.$('figure.items-box-photo > img');
          const propAlt = await imgTag.getProperty('alt');
          const title = await propAlt.jsonValue();
          if (!excludeWord.test(title)){
            const itemBoxPrice = await itemBlock.$('div.items-box-body > div.items-box-num > div.items-box-price');
            const propPrice = await itemBoxPrice.getProperty('textContent');
            const priceText = await propPrice.jsonValue();
            const priceResult = priceText.match(/([\d,])+/);
            const propSrc = await imgTag.getProperty('src');
            const src = await propSrc.jsonValue();
            const result = src.match(/^https:\/\/static-mercari-jp-imgtr2.akamaized.net\/thumb\/photos\/(.+)_\d?\.jpg/);
            if(result){
              if (oldItemsId.indexOf(result[1]) === -1) {
                const obj = {
                  id: result[1],
                  title: title,
                  src: result[0],
                  createdAt: new Date()
                };
                if(priceResult) {
                  obj.price = priceResult[0];
                }
                items.push(obj);
                newItems.push(obj);
              }
            }
          }
        }
  
        if (newItems.length > 0) {
          const content = JSON.stringify(items);
          fs.writeFile(filePath, content, (error) => {
            if (error) {
              console.log('error: ファイル書き込みエラーです');
            } else {
              console.log('success: ' + filePath + ' を上書き');
              postSlack(newItems);
            }
          });
        } else {
          console.log('newItem はありませんでした');
        }
  
        await browser.close();
      })();
    }
  });
});
