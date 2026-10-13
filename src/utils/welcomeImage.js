import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const TextToSVG = require('text-to-svg');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fontPath = path.join(__dirname, '../../fonts/Anton-Regular.ttf');
const textToSVG = TextToSVG.loadSync(fontPath);

async function downloadImage(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
}

export const DEFAULT_WELCOME_BACKGROUND_PATH = path.join(__dirname, '../assets/welcome-background-parts');
export const DEFAULT_WELCOME_BACKGROUND = Buffer.from([
    readFileSync(path.join(DEFAULT_WELCOME_BACKGROUND_PATH, 'part01.txt'), 'utf8'),
    readFileSync(path.join(DEFAULT_WELCOME_BACKGROUND_PATH, 'part02.txt'), 'utf8'),
    readFileSync(path.join(DEFAULT_WELCOME_BACKGROUND_PATH, 'part03.txt'), 'utf8'),
    readFileSync(path.join(DEFAULT_WELCOME_BACKGROUND_PATH, 'part04.txt'), 'utf8'),
    readFileSync(path.join(DEFAULT_WELCOME_BACKGROUND_PATH, 'part05.txt'), 'utf8'),
    readFileSync(path.join(DEFAULT_WELCOME_BACKGROUND_PATH, 'part06.txt'), 'utf8'),
    readFileSync(path.join(DEFAULT_WELCOME_BACKGROUND_PATH, 'part07.txt'), 'utf8'),
    readFileSync(path.join(DEFAULT_WELCOME_BACKGROUND_PATH, 'part08.txt'), 'utf8'),
    readFileSync(path.join(DEFAULT_WELCOME_BACKGROUND_PATH, 'part09.txt'), 'utf8'),
    readFileSync(path.join(DEFAULT_WELCOME_BACKGROUND_PATH, 'part10.txt'), 'utf8'),
].join(''), 'base64');

async function loadBackground(backgroundUrl) {
    if (!backgroundUrl) return DEFAULT_WELCOME_BACKGROUND;

    try {
        const response = await fetch(backgroundUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Referer': 'https://phototourl.com/',
            },
        });
        if (!response.ok) throw new Error(`Background request returned ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        const metadata = await sharp(buffer).metadata();
        if (!metadata.width || !metadata.height) throw new Error('Background response is not a supported image');
        return buffer;
    } catch (error) {
        console.warn(`[WelcomeImage] Using bundled original artwork after custom background failed: ${error.message}`);
        return DEFAULT_WELCOME_BACKGROUND;
    }
}

export async function generateWelcomeImage({
    backgroundUrl,
    avatarUrl,
    username,
    memberCount
}) {
    // Always produce a banner. Use the configured artwork when it works;
    // otherwise fall back to a built-in dark-blue fantasy design. Also fall
    // back if a custom URL responds successfully but isn't a valid image.
    let background;
    try {
        const backgroundBuffer = await loadBackground(backgroundUrl);
        background = await sharp(backgroundBuffer)
            .resize(1200, 500, {
                fit: 'cover',
                position: 'centre'
            })
            .png()
            .toBuffer();
    } catch (error) {
        if (!backgroundUrl) throw error;
        console.warn(`[WelcomeImage] Custom background was invalid; using built-in design: ${error.message}`);
        background = await sharp(DEFAULT_WELCOME_BACKGROUND)
            .resize(1200, 500, {
                fit: 'cover',
                position: 'centre'
            })
            .png()
            .toBuffer();
    }

    // Avatar
    const avatarSize = 300;
    const avatarBuffer = await downloadImage(avatarUrl);

    const avatar = await sharp(avatarBuffer)
        .resize(avatarSize, avatarSize, {
            fit: 'cover'
        })
        .composite([
            {
                input: Buffer.from(`
                    <svg width="300" height="300">
                        <circle
                            cx="150"
                            cy="150"
                            r="143"
                            fill="white"
                        />
                    </svg>
                `),
                blend: 'dest-in'
            }
        ])
        .png()
        .toBuffer();

    // Text paths using Anton font
    const welcomePath = textToSVG.getD('WELCOME', {
    fontSize: 58,
    anchor: 'center baseline'
});

const usernamePath = textToSVG.getD(String(username), {
    fontSize: 46,
    anchor: 'center baseline'
});

const memberPath = textToSVG.getD(`MEMBER #${memberCount}`, {
    fontSize: 30,
    anchor: 'center baseline'
});

    // Text + visible avatar border
    const overlay = Buffer.from(`
        <svg width="1200" height="500">

            <!-- White avatar border -->
            <circle
                cx="600"
                cy="155"
                r="143"
                fill="none"
                stroke="white"
                stroke-width="10"
            />

            <!-- Welcome text -->
            <path
                d="${welcomePath}"
                transform="translate(600, 370)"
                fill="white"
            />

            <!-- Username -->
            <path
                d="${usernamePath}"
                transform="translate(600, 415)"
                fill="white"
            />

            <!-- Member number -->
            <path
                d="${memberPath}"
                transform="translate(600, 455)"
                fill="white"
            />

        </svg>
    `);

    return sharp(background)
        .composite([
            {
                input: avatar,
                left: 450,
                top: 5
            },
            {
                input: overlay,
                left: 0,
                top: 0
            }
        ])
        .png()
        .toBuffer();
}
