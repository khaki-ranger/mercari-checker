'use strict';

const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://www.tumolink.com');
  await page.screenshot({path: 'tumolink.png'});
 
  await browser.close();
})();
