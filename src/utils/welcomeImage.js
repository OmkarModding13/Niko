import sharp from 'sharp';
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

export async function generateWelcomeImage({
    backgroundUrl,
    avatarUrl,
    username,
    memberCount
}) {
    if (!backgroundUrl) {
        throw new Error('Welcome background image is not configured.');
    }

    const backgroundBuffer = await downloadImage(backgroundUrl);

    const background = await sharp(backgroundBuffer)
        .resize(1200, 500, {
            fit: 'cover',
            position: 'centre'
        })
        .png()
        .toBuffer();

    // Large avatar
    const avatarSize = 300;
    const avatarBuffer = await downloadImage(avatarUrl);

    const avatar = await sharp(avatarBuffer)
        .resize(avatarSize, avatarSize, {
            fit: 'cover'
        })
        .composite([
            {
                input: Buffer.from(`
                    <svg width="${avatarSize}" height="${avatarSize}">
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

    // Convert text into SVG paths using Anton font
    const welcomePath = textToSVG.getD('WELCOME', {
        fontSize: 72,
        anchor: 'center baseline'
    });

    const usernamePath = textToSVG.getD(String(username), {
        fontSize: 60,
        anchor: 'center baseline'
    });

    const memberPath = textToSVG.getD(`MEMBER #${memberCount}`, {
        fontSize: 34,
        anchor: 'center baseline'
    });

    const textOverlay = Buffer.from(`
        <svg width="1200" height="500">

            <g fill="white">

                <path
                    d="${welcomePath}"
                    transform="translate(600, 345)"
                />

                <path
                    d="${usernamePath}"
                    transform="translate(600, 415)"
                />

                <path
                    d="${memberPath}"
                    transform="translate(600, 465)"
                />

            </g>

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
                input: textOverlay,
                left: 0,
                top: 0
            }
        ])
        .png()
        .toBuffer();
}
