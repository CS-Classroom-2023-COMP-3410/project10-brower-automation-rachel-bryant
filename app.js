const puppeteer = require('puppeteer');
const fs = require('fs');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let credentials;
try {
  const jsonString = fs.readFileSync('credentials.json', 'utf8');
  credentials = JSON.parse(jsonString);
} catch (err) {
  console.error('Error reading or parsing file: ', err);
}

(async () => {
    const browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Navigate to GitHub login page
    await page.goto('https://github.com/login');

    // TODO: Login to GitHub using the provided credentials
    const userField = await page.$('#login_field');
    const passField = await page.$('#password');
    const submitBtn = await page.$('input[value="Sign in"]');
    await userField.type(credentials.username);
    await passField.type(credentials.password);
    await submitBtn.click();

    // Wait for successful login
    await page.waitForSelector('.avatar.circle');

    // Extract the actual GitHub username to be used later
    const actualUsername = await page.$eval('meta[name="octolytics-actor-login"]', meta => meta.content);

    const repositories = ["cheeriojs/cheerio", "axios/axios", "puppeteer/puppeteer"];

    for (const repo of repositories) {
        await page.goto(`https://github.com/${repo}`, { waitUntil: 'networkidle2' });
        // TODO: Star the repository
        const starBtn = await page.waitForSelector('.js-toggler-target.BtnGroup-item');
        await starBtn.evaluate(b => b.scrollIntoView({ block: 'center' }));
        await sleep(500);
        await starBtn.evaluate(b => b.click());
        await sleep(1000);
    }
    console.log("pages starred");

    // TODO: Navigate to the user's starred repositories page
    await page.goto(`https://github.com/${actualUsername}?tab=stars`);

    // TODO: Click on the "Create list" button
    const buttons = await page.$$('button');
    let createListBtn;
    for (const btn of buttons) {
      const text = await btn.evaluate(b => b.innerText.trim());
      if (text === 'Create list') {
        createListBtn = btn;
        break;
      }
    }
    await sleep(500);
    await createListBtn.evaluate(b => b.scrollIntoView());
    await createListBtn.evaluate(b => b.click());
    await sleep(1000);

    // TODO: Create a list named "Node Libraries"
    const listInput = await page.waitForSelector('#user_list_name', { visible: true });
    await listInput.click();
    await listInput.type("Node Libraries");
    await sleep(500);

    // Wait for the "Create" button to become enabled
    const createBtn = await page.waitForSelector('.Button--fullWidth.mt-2:not([disabled])', { visible: true });
    await createBtn.evaluate(b => b.click());

    // Allow some time for the list creation process
    await sleep(2000);

    for (const repo of repositories) {
        await page.goto(`https://github.com/${repo}`);

        // TODO: Add this repository to the "Node Libraries" list
        const dropdown = await page.waitForSelector('[id$="-starred"]');
        await dropdown.evaluate(b => b.scrollIntoView({ block: 'center' }));
        await sleep(300);
        const summary = await dropdown.$('summary');
        await summary.evaluate(b => b.click());
        await sleep(1000);
        const lists = await page.$$('.js-user-list-menu form');

        for (const list of lists) {
          const textHandle = await list.getProperty('innerText');
          const text = await textHandle.jsonValue();
          if (text.includes('Node Libraries')) {
            await list.click();
            break;
          }
        }

        await sleep(1000);

        // Close the dropdown to finalize the addition to the list
        await summary.evaluate(b => b.click());
      }

    // Close the browser
    await browser.close();
})();