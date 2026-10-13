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

export const DEFAULT_WELCOME_BACKGROUND_URL = 'https://cdn.phototourl.com/free/2026-07-26-7208305c-e1d8-470c-8ff7-f1ea578696a1.png';

const DEFAULT_WELCOME_BACKGROUND = Buffer.from(`<svg width="1200" height="500" viewBox="0 0 1200 500" xmlns="http://www.w3.org/2000/svg">
<defs>
 <linearGradient id="night" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#020611"/><stop offset=".48" stop-color="#061947"/><stop offset="1" stop-color="#020817"/></linearGradient>
 <radialGradient id="nebula"><stop stop-color="#1c79ff" stop-opacity=".78"/><stop offset=".45" stop-color="#0b3caa" stop-opacity=".42"/><stop offset="1" stop-color="#03081b" stop-opacity="0"/></radialGradient>
 <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#06112c"/><stop offset=".5" stop-color="#0b2b66"/><stop offset="1" stop-color="#050b20"/></linearGradient>
 <linearGradient id="glint" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#62c7ff" stop-opacity=".8"/><stop offset="1" stop-color="#193dff" stop-opacity="0"/></linearGradient>
 <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
</defs>
<rect width="1200" height="500" fill="url(#night)"/>
<ellipse cx="600" cy="260" rx="530" ry="260" fill="url(#nebula)"/>
<circle cx="945" cy="116" r="110" fill="#0751ca" opacity=".35" filter="url(#blur)"/>
<circle cx="950" cy="112" r="74" fill="#132d67" stroke="#3b8eff" stroke-width="2" opacity=".8"/>
<circle cx="950" cy="112" r="60" fill="#07122f" stroke="#75caff" stroke-width="1" opacity=".8"/>
<path d="M875 112 C905 60 970 52 1019 92 C981 78 934 93 917 137 C908 159 912 175 923 189 C886 170 861 142 875 112Z" fill="#7fd3ff" opacity=".46"/>
<g stroke="#418fff" stroke-width="2" opacity=".32" fill="none">
 <path d="M-20 35 Q100 125 45 260 T75 520"/><path d="M42 -20 Q170 90 120 220 T150 520"/>
 <path d="M1220 8 Q1090 96 1153 224 T1115 520"/><path d="M1160 -20 Q1050 86 1080 230 T1040 520"/>
 <path d="M70 0 L210 125 L170 230 L260 340"/><path d="M1120 0 L1000 140 L1035 250 L960 355"/>
</g>
<g fill="#9bd9ff" opacity=".8">
 <circle cx="105" cy="92" r="2.2"/><circle cx="205" cy="54" r="1.7"/><circle cx="305" cy="122" r="1.5"/><circle cx="420" cy="62" r="1.8"/>
 <circle cx="777" cy="50" r="1.8"/><circle cx="820" cy="175" r="1.5"/><circle cx="1070" cy="210" r="1.8"/><circle cx="1136" cy="70" r="2"/>
 <circle cx="87" cy="342" r="1.5"/><circle cx="240" cy="420" r="1.8"/><circle cx="1015" cy="385" r="1.7"/><circle cx="1100" cy="322" r="1.5"/>
</g>
<g fill="#020716" opacity=".9">
 <path d="M0 500V330L34 296L56 352L80 319L107 369L126 340L151 400L170 355L198 500Z"/>
 <path d="M0 500V430L55 392L88 425L125 386L154 424L189 405L225 500Z"/>
 <path d="M1200 500V325L1165 287L1140 355L1118 318L1090 378L1068 341L1045 396L1020 354L995 500Z"/>
 <path d="M1200 500V426L1148 387L1112 423L1079 390L1044 432L1015 411L980 500Z"/>
</g>
<g opacity=".38" fill="none" stroke="url(#glint)" stroke-width="5">
 <path d="M0 315 Q90 250 168 330 T305 310"/><path d="M1200 290 Q1114 244 1055 321 T910 305"/>
 <path d="M25 470 L190 390 L260 460"/><path d="M1175 466 L1020 382 L940 465"/>
</g>
<rect x="2" y="2" width="1196" height="496" rx="2" fill="none" stroke="#237cff" stroke-opacity=".32" stroke-width="4"/>
</svg>`);

async function loadBackground(backgroundUrl) {
    // Use the owner's original artwork by default, not the generated placeholder.
    // If a separately configured custom background is set, try it first.
    const candidates = [...new Set([backgroundUrl, DEFAULT_WELCOME_BACKGROUND_URL].filter(Boolean))];

    for (const sourceUrl of candidates) {
        try {
            const buffer = await downloadImage(sourceUrl);
            const metadata = await sharp(buffer).metadata();
            if (!metadata.width || !metadata.height || !metadata.format) {
                throw new Error('Downloaded background is not a supported image');
            }
            console.info(`[WelcomeImage] Loaded background: ${sourceUrl === DEFAULT_WELCOME_BACKGROUND_URL ? 'owner artwork' : 'configured custom image'} (${metadata.width}x${metadata.height})`);
            return buffer;
        } catch (error) {
            console.warn(`[WelcomeImage] Background failed (${sourceUrl === DEFAULT_WELCOME_BACKGROUND_URL ? 'owner artwork' : 'configured custom image'}): ${error.message}`);
        }
    }

    // Last-resort safety net only; the user's actual PNG is always attempted first.
    console.warn('[WelcomeImage] Owner artwork unavailable; using built-in emergency background.');
    return DEFAULT_WELCOME_BACKGROUND;
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
