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

        const avatarSize = 150;


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


        // Circular SVG mask

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
                        <!-- DARK READABILITY GRADIENT          -->
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
                                stop-opacity="0.94"
                            />

                            <stop
                                offset="55%"
                                stop-color="#02030a"
                                stop-opacity="0.50"
                            />

                            <stop
                                offset="100%"
                                stop-color="#02030a"
                                stop-opacity="0"
                            />

                        </linearGradient>


                        <!-- ================================= -->
                        <!-- GENERAL BLUE GLOW                   -->
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
                        <!-- PFP GLOW                            -->
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
                        width="760"
                        height="${HEIGHT}"
                        fill="url(#panel)"
                    />


                    <!-- ================================= -->
                    <!-- LEVEL UP                            -->
                    <!-- ================================= -->

                    <text
                        x="275"
                        y="120"
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
                        x="278"
                        y="140"
                        width="390"
                        height="5"
                        rx="2"
                        fill="#1687ff"
                        filter="url(#glow)"
                    />


                    <!-- ================================= -->
                    <!-- USERNAME                             -->
                    <!-- ================================= -->

                    <text
                        x="300"
                        y="220"
                        font-family="Arial, Helvetica, sans-serif"
                        font-size="36"
                        font-weight="700"
                        fill="#ffffff"
                    >
                        ${escapeXml(displayName)}
                    </text>


                    <!-- Username underline -->

                    <rect
                        x="300"
                        y="235"
                        width="330"
                        height="2"
                        rx="1"
                        fill="#1687ff"
                        opacity="0.65"
                    />


                    <!-- ================================= -->
                    <!-- REACHED LEVEL                       -->
                    <!-- ================================= -->

                    <text
                        x="300"
                        y="292"
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
                        x="300"
                        y="385"
                        font-family="Arial, Helvetica, sans-serif"
                        font-size="96"
                        font-weight="900"
                        fill="#ffffff"
                        filter="url(#glow)"
                    >
                        ${Number(newLevel)}
                    </text>


                    <!-- ================================= -->
                    <!-- DOMAIN TEXT                         -->
                    <!-- ================================= -->

                    <text
                        x="300"
                        y="435"
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
                        cx="185"
                        cy="285"
                        r="88"
                        fill="none"
                        stroke="#1687ff"
                        stroke-width="7"
                        opacity="0.95"
                        filter="url(#avatarGlow)"
                    />


                    <!-- ================================= -->
                    <!-- PFP WHITE BORDER                    -->
                    <!-- ================================= -->

                    <circle
                        cx="185"
                        cy="285"
                        r="82"
                        fill="none"
                        stroke="#ffffff"
                        stroke-width="4"
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

                    // Text + decorations
                    {
                        input: overlay,
                        top: 0,
                        left: 0
                    },

                    // Actual PFP
                    {
                        input: maskedAvatar,
                        top: 210,
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
