'use strict';

const puppeteer = require('puppeteer');
const settings = require('./settings');
const excludeWord = new RegExp(settings.target.excludeWord); 

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(settings.target.url);
  await page.waitForSelector('body > div > main > div.l-content');

  const items = await page.$$('body > div > main > div.l-content > section > div > section > a > figure > img');

  for (const item of items) {
    const propAlt = await item.getProperty('alt');
    const title = await propAlt.jsonValue();
    if (!excludeWord.test(title)){
      const propSrc = await item.getProperty('src');
      const src = await propSrc.jsonValue();
      const result = src.match(/^https:\/\/static-mercari-jp-imgtr2.akamaized.net\/thumb\/photos\/(.+)_\d?\.jpg/);
      if(result){
        const obj = {
          id: result[1],
          title: title,
          src: result[0],
        };
        console.log(obj);
      }
    }
  }

  await browser.close();
})();
