import { logger } from '../utils/logger.js';
import { getUserLevelData, saveUserLevelData } from './leveling/leveling.js';

const INACTIVE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function getGenderStyle(member) {
    const roles = member.roles.cache;
    const isMale = roles.some(role => role.name.trim().toLowerCase() === 'male');
    const isFemale = roles.some(role => role.name.trim().toLowerCase() === 'female');

    if (isMale && !isFemale) return 'flirty';
    if (isFemale && !isMale) return 'bestie';

    return 'normal';
}

function getReminderMessage(style) {
    if (style === 'flirty') {
        return [
            '😏 **Oii handsome... where have you been?**',
            '',
            '7 din se server pe gayab ho. 👀',
            'Niko ne notice kar liya hai... aur tumne abhi tak naye games bhi try nahi kiye? 🎮',
            '',
            'Itne saare games aaye hain aur tum bas disappear mode pe ho? 😭',
            'Chalo, wapas aao. Ek game try karo... warna Niko tumhe personally ping karne aa jayegi. 😏',
            '',
            '🎮 **Open `/games` and pick something!**'
        ].join('\n');
    }

    if (style === 'bestie') {
        return [
            '💅 **BESTIEEE, TU KAHAN GAYAB HAI?!** 😭',
            '',
            '7 din se server pe dikhi hi nahi!',
            'Itne saare naye games aaye hain aur tune ek bhi try nahi kiya? 😭🎮',
            '',
            'Come back bestie, ek game khelte hain!',
            'Niko aur baaki sab tera wait kar rahe hain. 💜',
            '',
            '🎮 **Open `/games` and come play!**'
        ].join('\n');
    }

    return [
        '👀 **Niko noticed you disappeared!**',
        '',
        '7 din se server pe tumhari koi baat nahi hui.',
        'Server mein naye games aaye hain aur tumne abhi tak try nahi kiya! 🎮',
        '',
        'Wapas aao aur `/games` check karo — kuch naya try karo. 😈',
        '',
        'Niko will be waiting. 💙'
    ].join('\n');
}

export async function checkInactiveMembers(client) {
    const now = Date.now();
    let checked = 0;
    let reminded = 0;

    for (const guild of client.guilds.cache.values()) {
        try {
            await guild.members.fetch();

            for (const member of guild.members.cache.values()) {
                if (member.user.bot) continue;

                checked += 1;

                const userData = await getUserLevelData(client, guild.id, member.id);
                const joinedAt = Number(member.joinedTimestamp || now);
                const lastChatAt = Number(userData.lastChatAt || 0);
                const activityBase = Math.max(lastChatAt, joinedAt);

                if (now - activityBase < INACTIVE_AFTER_MS) continue;

                // Only one reminder per inactive period.
                if (Number(userData.inactiveReminderAt || 0) >= activityBase) continue;

                const style = getGenderStyle(member);

                try {
                    await member.send({ content: getReminderMessage(style) });

                    userData.inactiveReminderAt = now;
                    await saveUserLevelData(client, guild.id, member.id, userData);
                    reminded += 1;
                } catch (dmError) {
                    logger.debug(
                        'Could not DM inactive member ' + member.id +
                        ' in guild ' + guild.id + ': ' + dmError.message
                    );
                }
            }
        } catch (error) {
            logger.error(
                'Failed inactive-member check for guild ' + guild.id + ':',
                error
            );
        }
    }

    logger.info(
        'Inactive member check complete: checked ' + checked + ', reminded ' + reminded
    );

    return { checked, reminded };
}

export default {
    checkInactiveMembers
};
