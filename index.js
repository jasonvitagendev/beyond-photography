const puppeteer = require('puppeteer');

const session = 'GEGIHGKCEEAHJMDNPJAPAMAK';

const getDownloadLink = async (pageURL) => {
    const browser = await puppeteer.launch({
        args: [
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
        ],
    });
    const page = await browser.newPage();
    await page.setCookie({
        name: 'ASPSESSIONIDAWTQBARD',
        value: session,
        domain: 'beyond.photos',
    });
    await page.goto(pageURL);

    const frame = page.frames().find((frame) => frame.name() === 'player1');

    const scriptContent = await (
        await frame.$('#player + script')
    ).evaluate((node) => node.textContent);

    const [, videoURL] = /width":1920.+?url":"(.+?)"/g.exec(scriptContent);

    console.log(videoURL);

    await browser.close();
};

getDownloadLink(
    'https://beyond.photos/content_new.asp?Course=Understanding+Histogram&Lesson=Course+Introduction'
);
