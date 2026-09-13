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

        const avatarSize = 170;

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
                                stop-opacity="0.94"
                            />

                            <stop
                                offset="60%"
                                stop-color="#02030a"
                                stop-opacity="0.48"
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
                                stdDeviation="6"
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
                        width="800"
                        height="${HEIGHT}"
                        fill="url(#panel)"
                    />


                    <!-- Decorative blue line -->

                    <rect
                        x="72"
                        y="82"
                        width="6"
                        height="285"
                        rx="3"
                        fill="#1687ff"
                        filter="url(#glow)"
                    />


                    <!-- LEVEL UP -->

                    <text
                        x="118"
                        y="120"
                        font-family="Arial, Helvetica, sans-serif"
                        font-size="68"
                        font-weight="900"
                        letter-spacing="4"
                        fill="#ffffff"
                    >
                        LEVEL UP!
                    </text>


                    <!-- Separator -->

                    <rect
                        x="120"
                        y="142"
                        width="390"
                        height="5"
                        rx="2"
                        fill="#1687ff"
                        filter="url(#glow)"
                    />


                    <!-- Username -->

                    <text
                        x="330"
                        y="215"
                        font-family="Arial, Helvetica, sans-serif"
                        font-size="36"
                        font-weight="700"
                        fill="#ffffff"
                    >
                        ${escapeXml(displayName)}
                    </text>


                    <!-- Small username underline -->

                    <rect
                        x="330"
                        y="230"
                        width="300"
                        height="2"
                        rx="1"
                        fill="#1687ff"
                        opacity="0.65"
                    />


                    <!-- Level label -->

                    <text
                        x="330"
                        y="285"
                        font-family="Arial, Helvetica, sans-serif"
                        font-size="25"
                        font-weight="600"
                        letter-spacing="3"
                        fill="#9bbcff"
                    >
                        REACHED LEVEL
                    </text>


                    <!-- Level number -->

                    <text
                        x="330"
                        y="375"
                        font-family="Arial, Helvetica, sans-serif"
                        font-size="92"
                        font-weight="900"
                        fill="#ffffff"
                        filter="url(#glow)"
                    >
                        ${Number(newLevel)}
                    </text>


                    <!-- Bottom decoration -->

                    <text
                        x="330"
                        y="425"
                        font-family="Arial, Helvetica, sans-serif"
                        font-size="18"
                        font-weight="600"
                        letter-spacing="2"
                        fill="#6f91c7"
                    >
                        HOLLOW DEVIL'S DOMAIN
                    </text>


                    <!-- Avatar glow circle -->

                    <circle
                        cx="205"
                        cy="285"
                        r="94"
                        fill="none"
                        stroke="#1687ff"
                        stroke-width="7"
                        opacity="0.9"
                        filter="url(#avatarGlow)"
                    />


                    <!-- Avatar border -->

                    <circle
                        cx="205"
                        cy="285"
                        r="88"
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
                        top: 200,
                        left: 120
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
