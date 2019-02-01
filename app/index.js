const puppeteer = require('puppeteer');
const nodemailer = require("nodemailer");
const {promisify} = require('util');
const fs = require('fs');

const readFileAsync = promisify(fs.readFile);

(async () => {
  const mailBody = await readFileAsync('.body.txt', {encoding: 'utf8'})

  console.log('launch')
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });
  const page = await browser.newPage();
  await  page.goto(process.env.FMWW_TOP_URL)
  await  page.waitForSelector('#form1\\:client')
  //await Promise.all([
  //  page.waitForSelector('#form1\\:client'),
  //  page.goto('https://hd3.jmode.jp/')
  //])
  await Promise.all([
    page.evaluate(arg => {
      document.getElementById('form1:client').value = arg.FMWW_ACCESS_KEY_ID
      document.getElementById('form1:person').value = arg.FMWW_USER_NAME
      document.getElementById('form1:clpass').value = arg.FMWW_SECRET_ACCESS_KEY
      document.getElementById('form1:pspass').value = arg.FMWW_PASSWORD

      setTimeout(() => {
        document.getElementById('form1:login').click()
      }, 100)
    }, { FMWW_ACCESS_KEY_ID     : process.env.FMWW_ACCESS_KEY_ID,
         FMWW_USER_NAME         : process.env.FMWW_USER_NAME,
         FMWW_SECRET_ACCESS_KEY : process.env.FMWW_SECRET_ACCESS_KEY,
         FMWW_PASSWORD          : process.env.FMWW_PASSWORD }),
    page.waitForNavigation({timeout: 60000, waitUntil: 'domcontentloaded'})
  ])
  console.log('signined')
  //await page.screenshot({ path: 'signined.png' });

  await page.waitForSelector('#menu\\:0 div:nth-child(1)')
  await page.waitForSelector('#menu\\:1 div:nth-child(1)')
  await page.waitForSelector('#menu\\:2 div:nth-child(1) div:nth-child(2)')
  //await page.screenshot({ path: 'menu.png' });

  await Promise.all([
    page.evaluate(x => {
      document.querySelector('#menu\\:0 div:nth-child(1)').click()
      document.querySelector('#menu\\:1 div:nth-child(1)').click()
      document.querySelector('#menu\\:2 div:nth-child(1) div:nth-child(2)').click()
    }),
    page.waitForNavigation({timeout: 60000, waitUntil: 'domcontentloaded'})
  ])
  await page.waitFor(() => !!document.querySelector('#loading'))
  await page.waitFor(() => document.querySelector('#loading').style.display === 'none')
  //await page.screenshot({ path: 'input_conditions.png' });

  await Promise.all([
    page.waitForNavigation(), // The promise resolves after navigation has finished
    page.click('#search_button'), // Clicking the link will indirectly cause a navigation
  ]);
  await page.waitFor(() => !!document.querySelector('#loading'))
  await page.waitFor(() => document.querySelector('#loading').style.display === 'none')
  await page.screenshot({ path: 'screenshot.png' });

  // 発注書一覧
  const isEmpty = await page.evaluate(x => document.querySelector('#list span.no_result') !== null)
  console.log(isEmpty)
  if(isEmpty) {
    await sendMail(mailBody)
  }
  await browser.close();
})();





function sendMail(body) {
  const xs = [process.env.SMTP_HOST || "",
              process.env.SMTP_AUTH_USER || "",
              process.env.SMTP_AUTH_PASS || "",
              process.env.EMAIL_ADDRESS_SENDER || ""];
  // 環境変数なし
  if(!xs.every((a) => a.length > 0)) {
    return;
  }

  //SMTPサーバの設定
  const smtp = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_AUTH_USER,
      pass: process.env.SMTP_AUTH_PASS
    }
  });

  //メール情報の作成
  const message = {
    from: process.env.EMAIL_ADDRESS_SENDER,
    to: process.env.COMMA_SEPARATED_EMAIL_ADDRESS_RECIPIENTS_TO.split(','),
    bcc: process.env.COMMA_SEPARATED_EMAIL_ADDRESS_RECIPIENTS_BCC.split(','),
    subject: process.env.EMAIL_SUBJECT,
    text: body,
    attachments: [
      {
        filename: 'screenshot.png',
        path: '/app/screenshot.png'
      }
    ]
  };

  return new Promise((resolve, reject) => {
    // メール送信
    try{
        smtp.sendMail(message, function(error, info){
            // エラー発生時
            if(error){
                console.log("send failed");
                console.log(error.message);
                reject()
                return;
            }
            
            // 送信成功
            console.log("send successful");
            console.log(info.messageId);
            resolve()
        });
    } catch(e) {
        console.log("Error",e);
        reject()
    }
  })
}
