import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CHARACTER_CATALOG, getOwnedCharacters } from './characters.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FLEX_DIR = path.resolve(__dirname, '../../assets/gacha/flex');

const WIDTH = 1200;
const HEIGHT = 900;
const CARD_WIDTH = 350;
const CARD_HEIGHT = 360;

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export async function createFlexImage(userData, displayName) {
    const owned = getOwnedCharacters(userData);
    const ownedCharacters = Object.keys(owned)
        .map(name => CHARACTER_CATALOG[name])
        .filter(Boolean);

    const cards = [];
    const columns = 3;
    const startX = 55;
    const startY = 170;
    const gapX = 25;
    const gapY = 25;

    for (let index = 0; index < ownedCharacters.length && index < 6; index += 1) {
        const character = ownedCharacters[index];
        const filePath = path.join(FLEX_DIR, character.flexImage);

        const image = await sharp(filePath)
            .resize(280, 270, { fit: 'contain', position: 'centre' })
            .png()
            .toBuffer();

        const x = startX + (index % columns) * (CARD_WIDTH + gapX);
        const y = startY + Math.floor(index / columns) * (CARD_HEIGHT + gapY);

        cards.push({
            input: image,
            left: x + 35,
            top: y + 25
        });
    }

    const overlayCards = ownedCharacters.slice(0, 6).map((character, index) => {
        const x = startX + (index % columns) * (CARD_WIDTH + gapX);
        const y = startY + Math.floor(index / columns) * (CARD_HEIGHT + gapY);
        const copies = Number(owned[character.name] || 1);

        return `
            <rect x="${x}" y="${y}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="22" fill="#090b14" stroke="#27314d" stroke-width="2"/>
            <text x="${x + CARD_WIDTH / 2}" y="${y + 315}" text-anchor="middle" font-family="Arial" font-size="24" font-weight="800" fill="#ffffff">${escapeXml(character.name)}</text>
            <text x="${x + 24}" y="${y + 348}" font-family="Arial" font-size="17" fill="#aeb9d6">${character.stars}★ ${escapeXml(character.rarity)}</text>
            <text x="${x + CARD_WIDTH - 24}" y="${y + 348}" text-anchor="end" font-family="Arial" font-size="17" fill="#aeb9d6">x${copies}</text>
        `;
    }).join('');

    const overlay = Buffer.from(`
        <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#070912"/>
                    <stop offset="100%" stop-color="#121a2d"/>
                </linearGradient>
            </defs>
            <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
            <text x="600" y="72" text-anchor="middle" font-family="Arial" font-size="46" font-weight="900" fill="#ffffff">CHARACTER COLLECTION</text>
            <text x="600" y="112" text-anchor="middle" font-family="Arial" font-size="22" fill="#8fa4d1">${escapeXml(displayName)} • ${ownedCharacters.length}/6 Characters Owned</text>
            ${ownedCharacters.length === 0 ? `
                <text x="600" y="500" text-anchor="middle" font-family="Arial" font-size="34" font-weight="700" fill="#ffffff">No characters owned yet.</text>
                <text x="600" y="545" text-anchor="middle" font-family="Arial" font-size="20" fill="#8fa4d1">Use /gacha to spend Shards and summon characters.</text>
            ` : overlayCards}
        </svg>
    `);

    const background = await sharp({
        create: {
            width: WIDTH,
            height: HEIGHT,
            channels: 4,
            background: { r: 7, g: 9, b: 18, alpha: 1 }
        }
    }).png().toBuffer();

    return sharp(background)
        .composite([
            { input: overlay, left: 0, top: 0 },
            ...cards
        ])
        .png()
        .toBuffer();
}
