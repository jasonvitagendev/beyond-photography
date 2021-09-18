const puppeteer = require('puppeteer');
const fs = require('fs');
const fsPromises = require('fs/promises');
const fetch = require('node-fetch');

const session = 'GEGIHGKCEEAHJMDNPJAPAMAK';

const browserCache = new Promise(async (resolve) => {
    const browser = await puppeteer.launch({
        args: [
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
        ],
    });
    resolve(browser);
});

const getPage = async (browser) => {
    const page = await browser.newPage();
    await page.setCookie({
        name: 'ASPSESSIONIDAWTQBARD',
        value: session,
        domain: 'beyond.photos',
    });
    return page;
};

const getDownloadLink = async (pageURL) => {
    const browser = await browserCache;
    const page = await getPage(browser);
    try {
        await page.goto(pageURL);
    } catch (err) {
        console.error(`${pageURL} navigation failed`);
        return;
    }
    await page.waitForTimeout(10000);

    const frame = page.frames().find((frame) => frame.name() === 'player1');

    if (!frame) {
        console.error(pageURL);
        return null;
    }

    const scriptContent = await (
        await frame.$('#player + script')
    ).evaluate((node) => node.textContent);

    const [, videoURL] = /width":1920.+?url":"(.+?)"/g.exec(scriptContent);

    return videoURL;
};

const downloadVideo = async (videoURL, folderPath, videoName) => {
    const response = await fetch(videoURL);

    response.body.pipe(fs.createWriteStream(`${folderPath}/${videoName}`));

    await new Promise((resolve) => response.body.on('finish', resolve));
};

const downloadLesson = async (lessonURL, index) => {
    const params = new URL(lessonURL).searchParams;

    const course = params.get('Course');
    const lesson = params.get('Lesson').replace('/', ' ');

    const videoURL = await getDownloadLink(lessonURL);

    if (!videoURL) {
        console.log(`${lessonURL} has no video link`);
        return;
    }

    const folderPath = `/Users/jason/Downloads/Beyond Photography/${course}`;

    const folderExists = await new Promise((resolve) => {
        fs.access(folderPath, fs.constants.W_OK, (err) => {
            resolve(!!!err);
        });
    });

    if (!folderExists) {
        await fsPromises.mkdir(folderPath, {
            recursive: true,
        });
    }

    await downloadVideo(
        videoURL,
        folderPath,
        `${course}-${index}-${lesson}.mp4`
    );
};

const downloadCourse = async (courseURL) => {
    const browser = await browserCache;
    const page = await getPage(browser);
    await page.goto(courseURL);

    const lessonLinks = await page.$$('.btn.btn-md.btn-info');
    const links = await Promise.all(
        lessonLinks.map((linkNode) =>
            linkNode.evaluate((node) => node.parentNode.href)
        )
    );

    console.log(`Total ${links.length} links`);

    await Promise.all(links.map((link, index) => downloadLesson(link, index)));

    await browser.close();
};

(async () => {
    const url =
        'https://beyond.photos/course_lessons.asp?Course=Shoot+Sharp+Photos+Everytime&Lesson=#';

    await downloadCourse(url);
})();
