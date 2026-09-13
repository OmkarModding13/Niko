import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKGROUND_PATH = path.resolve(
    __dirname,
    '../../assets/LevelUP.png'
);

const WIDTH = 1200;
const HEIGHT = 500;

/**
 * Creates the Level Up notification image.
 *
 * @param {import('discord.js').GuildMember} member
 * @param {number} newLevel
 * @returns {Promise<Buffer>}
 */
export async function createLevelUpImage(member, newLevel) {
    try {
        // -----------------------------
        // 1. Get member avatar
        // -----------------------------

        const avatarUrl =
            member.user.displayAvatarURL({
                extension: 'png',
                size: 512,
                forceStatic: true
            });

        const avatarResponse =
            await fetch(avatarUrl);

        if (!avatarResponse.ok) {
            throw new Error(
                `Failed to download avatar: ${avatarResponse.status}`
            );
        }

        const avatarBuffer =
            Buffer.from(
                await avatarResponse.arrayBuffer()
            );


        // -----------------------------
        // 2. Prepare circular avatar
        // -----------------------------

        const avatarSize = 150;

        const circularAvatar =
            await sharp(avatarBuffer)
                .resize(
                    avatarSize,
                    avatarSize,
                    {
                        fit: 'cover'
                    }
                )
                .png()
                .toBuffer();


        // Create circular mask

        const avatarMask =
            Buffer.from(`
                <svg
                    width="${avatarSize}"
                    height="${avatarSize}"
                >
                    <circle
                        cx="${avatarSize / 2}"
                        cy="${avatarSize / 2}"
                        r="${avatarSize / 2}"
                        fill="white"
                    />
                </svg>
            `);


        const maskedAvatar =
            await sharp(circularAvatar)
                .composite([
                    {
                        input: avatarMask,
                        blend: 'dest-in'
                    }
                ])
                .png()
                .toBuffer();


        // -----------------------------
        // 3. User information
        // -----------------------------

        const username =
            member.displayName ||
            member.user.username;


        // Prevent extremely long usernames

        const displayName =
            username.length > 22
                ? `${username.slice(0, 21)}…`
                : username;


        // -----------------------------
        // 4. SVG overlay
        // -----------------------------

        const overlay =
            Buffer.from(`
                <svg
                    width="${WIDTH}"
                    height="${HEIGHT}"
                    xmlns="http://www.w3.org/2000/svg"
                >

                    <defs>

                        <!-- Dark readable area -->

                        <linearGradient
                            id="panel"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="0"
                        >

                            <stop
                                offset="0%"
                                stop-color="#02030a"
                                stop-opacity="0.92"
                            />

                            <stop
                                offset="65%"
                                stop-color="#02030a"
                                stop-opacity="0.35"
                            />

                            <stop
                                offset="100%"
                                stop-color="#02030a"
                                stop-opacity="0"
                            />

                        </linearGradient>


                        <!-- Blue glow -->

                        <filter
                            id="glow"
                            x="-50%"
                            y="-50%"
                            width="200%"
                            height="200%"
                        >

                            <feGaussianBlur
                                stdDeviation="8"
                                result="blur"
                            />

                            <feMerge>

                                <feMergeNode
                                    in="blur"
                                />

                                <feMergeNode
                                    in="SourceGraphic"
                                />

                            </feMerge>

                        </filter>


                        <!-- Avatar glow -->

                        <filter
                            id="avatarGlow"
                            x="-50%"
                            y="-50%"
                            width="200%"
                            height="200%"
                        >

                            <feGaussianBlur
                                stdDeviation="5"
                                result="blur"
                            />

                            <feMerge>

                                <feMergeNode
                                    in="blur"
                                />

                                <feMergeNode
                                    in="SourceGraphic"
                                />

                            </feMerge>

                        </filter>

                    </defs>


                    <!-- Dark readable area -->

                    <rect
                        x="0"
                        y="0"
                        width="720"
                        height="${HEIGHT}"
                        fill="url(#panel)"
                    />


                    <!-- Decorative blue line -->

                    <rect
                        x="70"
                        y="85"
                        width="5"
                        height="250"
                        rx="2"
                        fill="#1687ff"
                        filter="url(#glow)"
                    />


                    <!-- LEVEL UP -->

                    <text
                        x="115"
                        y="125"
                        font-family="Arial, Helvetica, sans-serif"
                        font-size="62"
                        font-weight="900"
                        letter-spacing="4"
                        fill="#ffffff"
                    >
                        LEVEL UP!
                    </text>


                    <!-- Separator -->

                    <rect
                        x="117"
                        y="145"
                        width="260"
                        height="4"
                        rx="2"
                        fill="#1687ff"
                        filter="url(#glow)"
                    />


                    <!-- Username -->

                    <text
                        x="285"
                        y="220"
                        font-family="Arial, Helvetica, sans-serif"
                        font-size="32"
                        font-weight="700"
                        fill="#ffffff"
                    >
                        ${escapeXml(displayName)}
                    </text>


                    <!-- Level label -->

                    <text
                        x="285"
                        y="285"
                        font-family="Arial, Helvetica, sans-serif"
                        font-size="24"
                        font-weight="600"
                        letter-spacing="3"
                        fill="#9bbcff"
                    >
                        REACHED LEVEL
                    </text>


                    <!-- Level number -->

                    <text
                        x="285"
                        y="370"
                        font-family="Arial, Helvetica, sans-serif"
                        font-size="82"
                        font-weight="900"
                        fill="#ffffff"
                        filter="url(#glow)"
                    >
                        ${Number(newLevel)}
                    </text>


                    <!-- Bottom decoration -->

                    <text
                        x="285"
                        y="420"
                        font-family="Arial, Helvetica, sans-serif"
                        font-size="18"
                        font-weight="600"
                        letter-spacing="2"
                        fill="#6f91c7"
                    >
                        THE HOLLOW DEVIL'S DOMAIN
                    </text>


                    <!-- Avatar glow circle -->

                    <circle
                        cx="185"
                        cy="265"
                        r="82"
                        fill="none"
                        stroke="#1687ff"
                        stroke-width="6"
                        opacity="0.9"
                        filter="url(#avatarGlow)"
                    />


                    <!-- Avatar border -->

                    <circle
                        cx="185"
                        cy="265"
                        r="78"
                        fill="none"
                        stroke="#ffffff"
                        stroke-width="4"
                    />

                </svg>
            `);


        // -----------------------------
        // 5. Resize background
        // -----------------------------

        const background =
            await sharp(BACKGROUND_PATH)
                .resize(
                    WIDTH,
                    HEIGHT,
                    {
                        fit: 'cover',
                        position: 'centre'
                    }
                )
                .png()
                .toBuffer();


        // -----------------------------
        // 6. Composite everything
        // -----------------------------

        const result =
            await sharp(background)
                .composite([
                    {
                        input: overlay,
                        top: 0,
                        left: 0
                    },

                    {
                        input: maskedAvatar,
                        top: 187,
                        left: 110
                    }
                ])
                .png()
                .toBuffer();


        return result;


    } catch (error) {

        console.error(
            '[LevelUpImage] Failed to create level-up image:',
            error
        );

        throw error;
    }
}


/**
 * Prevent user-controlled text
 * from breaking SVG.
 */

function escapeXml(value) {

    return String(value)
        .replace(
            /&/g,
            '&amp;'
        )
        .replace(
            /</g,
            '&lt;'
        )
        .replace(
            />/g,
            '&gt;'
        )
        .replace(
            /"/g,
            '&quot;'
        )
        .replace(
            /'/g,
            '&apos;'
        );
}
