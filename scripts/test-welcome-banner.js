import sharp from 'sharp';
import { DEFAULT_WELCOME_BACKGROUND_URL, generateWelcomeImage } from '../src/utils/welcomeImage.js';

const avatarSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#203d80"/><circle cx="128" cy="128" r="92" fill="#86c8ff"/></svg>';
const avatarUrl = `data:image/svg+xml,${encodeURIComponent(avatarSvg)}`;

// Prove the owner's exact linked background is reachable from the production PC.
const response = await fetch(DEFAULT_WELCOME_BACKGROUND_URL, { headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': 'https://phototourl.com/'
    } });
if (!response.ok) {
    throw new Error(`Owner background URL failed with HTTP ${response.status}`);
}
const sourceImage = Buffer.from(await response.arrayBuffer());
const sourceMetadata = await sharp(sourceImage).metadata();
if (sourceMetadata.format !== 'png' || !sourceMetadata.width || !sourceMetadata.height) {
    throw new Error(`Owner background URL did not return a PNG: ${JSON.stringify(sourceMetadata)}`);
}

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
console.log(`[BANNER_TEST] PASS output=${metadata.width}x${metadata.height} PNG bytes=${image.length}; ownerBackground=${sourceMetadata.width}x${sourceMetadata.height} PNG fetched from the supplied URL`);
