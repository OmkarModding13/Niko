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

    const safeUsername = escapeXml(username);
    const safeMemberCount = escapeXml(memberCount);

    const textOverlay = Buffer.from(`
    <svg width="1200" height="500">

        <text
            x="600"
            y="345"
            text-anchor="middle"
            fill="white"
            font-family="DejaVu Sans"
            font-size="72"
            font-weight="bold">
            WELCOME
        </text>

        <text
            x="600"
            y="415"
            text-anchor="middle"
            fill="white"
            font-family="DejaVu Sans"
            font-size="60"
            font-weight="bold">
            ${safeUsername}
        </text>

        <text
            x="600"
            y="465"
            text-anchor="middle"
            fill="white"
            font-family="DejaVu Sans"
            font-size="34"
            font-weight="bold"
            letter-spacing="3">
            MEMBER #${safeMemberCount}
        </text>

    </svg>
`);
}
