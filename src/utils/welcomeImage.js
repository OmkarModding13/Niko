import sharp from 'sharp';

function escapeXml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

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

    // Download background
    const backgroundBuffer = await downloadImage(backgroundUrl);

    // Create fixed Discord-friendly banner
    const background = await sharp(backgroundBuffer)
        .resize(1200, 500, {
            fit: 'cover',
            position: 'centre'
        })
        .png()
        .toBuffer();

    // Download and prepare avatar
    const avatarBuffer = await downloadImage(avatarUrl);

    const avatar = await sharp(avatarBuffer)
        .resize(150, 150, {
            fit: 'cover'
        })
        .composite([
            {
                input: Buffer.from(`
                    <svg width="150" height="150">
                        <circle cx="75" cy="75" r="75" fill="white"/>
                    </svg>
                `),
                blend: 'dest-in'
            }
        ])
        .png()
        .toBuffer();

    // Dynamic text
    const safeUsername = escapeXml(username);
    const safeMemberCount = escapeXml(memberCount);

    const textOverlay = Buffer.from(`
        <svg width="1200" height="500">
            <defs>
                <linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="black" stop-opacity="0.15"/>
                    <stop offset="1" stop-color="black" stop-opacity="0.35"/>
                </linearGradient>
            </defs>

            <rect width="1200" height="500" fill="url(#overlay)"/>

            <text
                x="600"
                y="285"
                text-anchor="middle"
                fill="white"
                font-family="Arial, sans-serif"
                font-size="42"
                font-weight="700"
                letter-spacing="6">
                WELCOME
            </text>

            <text
                x="600"
                y="350"
                text-anchor="middle"
                fill="white"
                font-family="Arial, sans-serif"
                font-size="52"
                font-weight="800">
                ${safeUsername}
            </text>

            <text
                x="600"
                y="405"
                text-anchor="middle"
                fill="white"
                font-family="Arial, sans-serif"
                font-size="26"
                font-weight="600"
                letter-spacing="3">
                MEMBER #${safeMemberCount}
            </text>
        </svg>
    `);

    return sharp(background)
        .composite([
            {
                input: avatar,
                left: 525,
                top: 55
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
