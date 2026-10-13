import sharp from 'sharp';
import { DEFAULT_WELCOME_BACKGROUND, generateWelcomeImage } from '../src/utils/welcomeImage.js';

const ownerBackground = await sharp(DEFAULT_WELCOME_BACKGROUND).metadata();
if (ownerBackground.format !== 'webp' || ownerBackground.width !== 1024 || ownerBackground.height !== 500) {
    throw new Error(`Bundled owner artwork failed validation: ${JSON.stringify(ownerBackground)}`);
}
console.log(`[BANNER_TEST] Original owner artwork OK: ${ownerBackground.width}x${ownerBackground.height} ${ownerBackground.format}`);

const avatarSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#203d80"/><circle cx="128" cy="128" r="92" fill="#86c8ff"/></svg>';
const avatarUrl = `data:image/svg+xml,${encodeURIComponent(avatarSvg)}`;

const image = await generateWelcomeImage({
    backgroundUrl: null,
    avatarUrl,
    username: 'Banner Test',
    memberCount: 28,
});

const metadata = await sharp(image).metadata();
if (metadata.format !== 'png' || metadata.width !== 1200 || metadata.height !== 500 || image.length < 10000) {
    throw new Error(`Unexpected welcome banner output: ${JSON.stringify({ format: metadata.format, width: metadata.width, height: metadata.height, bytes: image.length })}`);
}
console.log(`[BANNER_TEST] PASS format=${metadata.format} dimensions=${metadata.width}x${metadata.height} bytes=${image.length} customBackground=none`);
