const puppeteer = require('puppeteer');
const fs = require('fs');
const fsPromises = require('fs/promises');
const fetch = require('node-fetch');
const chalk = require('chalk');

if (!process.argv[2]) {
    console.log(chalk.red('Please pass in session value'));
    process.exit(0);
}

// get session value from cli
const session = process.argv[2];

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
        console.log(`${pageURL} ${chalk.red('navigation failed')}`);
        return;
    }

    const frame = page.frames().find((frame) => frame.name() === 'player1');

    if (!frame) {
        return null;
    }

    const scriptContent = await (
        await frame.$('#player + script')
    ).evaluate((node) => node.textContent);

    const [, videoURL] = /width":1920.+?url":"(.+?)"/g.exec(scriptContent);

    return videoURL;
};

const downloadVideo = async (videoURL, folderPath, videoName) => {
    // todo: check if there is existing video and do a head request to compare file size
    const filePath = `${folderPath}/${videoName}`;

    const fileExists = await new Promise((resolve) => {
        fs.access(filePath, fs.constants.F_OK, (err) => {
            resolve(!!!err);
        });
    });

    if (fileExists) {
        // check file size
        const stat = await fsPromises.stat(filePath);

        // get online video stat
        const videoStat = await fetch(videoURL, {
            method: 'head',
        });

        // get online video length
        const videoSize = Number(videoStat.headers.get('content-length'));

        // compare video size
        if (stat.size === videoSize) {
            return;
        }
    }

    console.log(chalk.green(`Downloading ${videoName}`));

    const response = await fetch(videoURL);

    response.body.pipe(fs.createWriteStream(filePath));

    await new Promise((resolve) =>
        response.body
            .on('finish', () => {
                console.log(chalk.green(`Done downloading ${videoName}`));
                resolve();
            })
            .on('error', () => {
                console.log(chalk.red(`Error downloading ${videoName}`));
            })
    );
};

const downloadLesson = async (lessonURL, index) => {
    const params = new URL(lessonURL).searchParams;

    const course = params.get('Course');
    const lesson = params.get('Lesson').replace('/', ' ');

    // get video URL
    const videoURL = await getDownloadLink(lessonURL);

    // report if there is no video URL
    if (!videoURL) {
        console.log(`${lesson} ${chalk.red('has no video URL')}`);
        return;
    }

    const folderPath = `/Users/jason/Downloads/Beyond Photography/${course}`;

    // check if there is existing folder
    const folderExists = await new Promise((resolve) => {
        fs.access(folderPath, fs.constants.W_OK, (err) => {
            resolve(!!!err);
        });
    });

    // create folder if not exists
    if (!folderExists) {
        await fsPromises.mkdir(folderPath, {
            recursive: true,
        });
    }

    // download video
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

    // query for lesson buttons
    const lessonLinks = await page.$$('.btn.btn-md.btn-info');

    // extract lesson links
    const links = await Promise.all(
        lessonLinks.map((linkNode) =>
            linkNode.evaluate((node) => node.parentNode.href)
        )
    );

    console.log(chalk.blue.underline(`Total ${links.length} links`));

    // download lessons
    await Promise.all(links.map((link, index) => downloadLesson(link, index)));

    await browser.close();
};

(async () => {
    await downloadCourse(
        'https://beyond.photos/course_lessons.asp?Course=E%2DLearning+Product+Photography&Lesson=#'
    );
})();
