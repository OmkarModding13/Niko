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

    // Background
    const backgroundBuffer = await downloadImage(backgroundUrl);

    const background = await sharp(backgroundBuffer)
        .resize(1200, 500, {
            fit: 'cover',
            position: 'centre'
        })
        .png()
        .toBuffer();

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
                transform="translate(600, 390)"
                fill="white"
            />

            <!-- Username -->
            <path
                d="${usernamePath}"
                transform="translate(600, 440)"
                fill="white"
            />

            <!-- Member number -->
            <path
                d="${memberPath}"
                transform="translate(600, 480)"
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
