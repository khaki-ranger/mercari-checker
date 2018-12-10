'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const Slack = require('node-slackr');
const cron = require('node-cron');

const settings = require('./settings');
const excludeWord = new RegExp(settings.target.excludeWord); 
const filePath = path.join(__dirname, 'items.json');

cron.schedule('* * * * *', () => {
  const postSlack = ((newItems) => {
    const attachments = [];
    for (const newItem of newItems) {
      const fields = [];
      const field = {
        title: newItem.title,
        value: '<https://item.mercari.com/jp/' + newItem.id + '/>'
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
        const imgTags = await page.$$('body > div > main > div.l-content > section > div > section > a > figure > img');
    
        for (const imgTag of imgTags) {
          const propAlt = await imgTag.getProperty('alt');
          const title = await propAlt.jsonValue();
          if (!excludeWord.test(title)){
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
