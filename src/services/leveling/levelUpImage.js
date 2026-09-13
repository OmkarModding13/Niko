import path from 'node:path';
import { fileURLToPath } from 'url';
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

        // ==========================================
        // 1. GET MEMBER AVATAR
        // ==========================================

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


        // ==========================================
        // 2. CREATE CIRCULAR PFP
        // ==========================================

        const avatarSize = 180;


        const circularAvatar =
            await sharp(avatarBuffer)
                .resize(
                    avatarSize,
                    avatarSize,
                    {
                        fit: 'cover',
                        position: 'centre'
                    }
                )
                .png()
                .toBuffer();


        // Circular mask

        const avatarMask =
            Buffer.from(`
                <svg
                    width="${avatarSize}"
                    height="${avatarSize}"
                    xmlns="http://www.w3.org/2000/svg"
                >

                    <circle
                        cx="${avatarSize / 2}"
                        cy="${avatarSize / 2}"
                        r="${avatarSize / 2}"
                        fill="#ffffff"
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


        // ==========================================
        // 3. USERNAME
        // ==========================================

        const username =
            member.displayName ||
            member.user.username;


        const displayName =
            username.length > 22
                ? `${username.slice(0, 21)}…`
                : username;


        // ==========================================
        // 4. SVG OVERLAY
        // ==========================================

        const overlay =
            Buffer.from(`
                <svg
                    width="${WIDTH}"
                    height="${HEIGHT}"
                    xmlns="http://www.w3.org/2000/svg"
                >

                    <defs>

                        <!-- ================================= -->
                        <!-- DARK LEFT READABILITY AREA          -->
                        <!-- ================================= -->

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
                                stop-opacity="0.95"
                            />

                            <stop
                                offset="55%"
                                stop-color="#02030a"
                                stop-opacity="0.55"
                            />

                            <stop
                                offset="100%"
                                stop-color="#02030a"
                                stop-opacity="0"
                            />

                        </linearGradient>


                        <!-- ================================= -->
                        <!-- BLUE GLOW                            -->
                        <!-- ================================= -->

                        <filter
                            id="glow"
                            x="-50%"
                            y="-50%"
                            width="200%"
                            height="200%"
                        >

                            <feGaussianBlur
                                stdDeviation="7"
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


                        <!-- ================================= -->
                        <!-- AVATAR GLOW                         -->
                        <!-- ================================= -->

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


                    <!-- ================================= -->
                    <!-- DARK LEFT PANEL                     -->
                    <!-- ================================= -->

                    <rect
                        x="0"
                        y="0"
                        width="790"
                        height="${HEIGHT}"
                        fill="url(#panel)"
                    />


                    <!-- ================================= -->
                    <!-- LEVEL UP                            -->
                    <!-- ================================= -->

                    <text
                        x="510"
                        y="105"
                        text-anchor="middle"
                        font-family="Arial, Helvetica, sans-serif"
                        font-size="68"
                        font-weight="900"
                        letter-spacing="4"
                        fill="#ffffff"
                        filter="url(#glow)"
                    >
                        LEVEL UP!
                    </text>


                    <!-- LEVEL UP UNDERLINE -->

                    <rect
                        x="325"
                        y="125"
                        width="370"
                        height="5"
                        rx="2"
                        fill="#1687ff"
                        filter="url(#glow)"
                    />


                    <!-- ================================= -->
<!-- USERNAME                           -->
<!-- ================================= -->

<text
    x="510"
    y="195"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="36"
    font-weight="700"
    fill="#ffffff"
>
    ${escapeXml(displayName)}
</text>


<!-- Username underline -->

<rect
    x="365"
    y="212"
    width="290"
    height="2"
    rx="1"
    fill="#1687ff"
    opacity="0.65"
/>


                    <!-- ================================= -->
                    <!-- REACHED LEVEL                       -->
                    <!-- ================================= -->

                    <text
                        x="510"
                        y="270"
                        text-anchor="middle"
                        font-family="Arial, Helvetica, sans-serif"
                        font-size="25"
                        font-weight="600"
                        letter-spacing="3"
                        fill="#9bbcff"
                    >
                        REACHED LEVEL
                    </text>


                    <!-- ================================= -->
                    <!-- LEVEL NUMBER                        -->
                    <!-- ================================= -->

                    <text
                        x="510"
                        y="365"
                        text-anchor="middle"
                        font-family="Arial, Helvetica, sans-serif"
                        font-size="96"
                        font-weight="900"
                        fill="#ffffff"
                        filter="url(#glow)"
                    >
                        ${Number(newLevel)}
                    </text>


                    <!-- ================================= -->
                    <!-- DOMAIN                              -->
                    <!-- ================================= -->

                    <text
                        x="510"
                        y="425"
                        text-anchor="middle"
                        font-family="Arial, Helvetica, sans-serif"
                        font-size="18"
                        font-weight="600"
                        letter-spacing="2"
                        fill="#6f91c7"
                    >
                        HOLLOW DEVIL'S DOMAIN
                    </text>


                    <!-- ================================= -->
                    <!-- PFP GLOW                            -->
                    <!-- ================================= -->

                    <circle
                        cx="180"
                        cy="250"
                        r="103"
                        fill="none"
                        stroke="#1687ff"
                        stroke-width="8"
                        opacity="0.95"
                        filter="url(#avatarGlow)"
                    />


                    <!-- ================================= -->
                    <!-- PFP BORDER                          -->
                    <!-- ================================= -->

                    <circle
                        cx="180"
                        cy="250"
                        r="95"
                        fill="none"
                        stroke="#ffffff"
                        stroke-width="5"
                    />

                </svg>
            `);


        // ==========================================
        // 5. RESIZE ORIGINAL BACKGROUND
        // ==========================================

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


        // ==========================================
        // 6. COMPOSITE
        // ==========================================

        const result =
            await sharp(background)
                .composite([

                    // Text and layout
                    {
                        input: overlay,
                        top: 0,
                        left: 0
                    },

                    // Member PFP
                    {
                        input: maskedAvatar,
                        top: 160,
                        left: 90
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
