import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const TOTAL_SOULS_EMOJI = '<:Total:1547545479628333086>';
const DOUBLE_SOULS_EMOJI = '<:DoubleSouls:1549009386389766264>';
const SHARD_EMOJI = '<:Shard:1548962748321374218>';
const TAILS_EMOJI = '<:Tails:1549019689022132315>';

export default {
    data: new SlashCommandBuilder()
        .setName('games')
        .setDescription('View the games available in Hollow Devil’s Domain.'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x168BFF)
            .setTitle('🎮 NIKO GAMES')
            .setDescription(
                'Enter a game with **Souls**, take your chance, and try to collect the rare **Shards**.\n\n' +
                '**💰 HOW ENTRY FEES WORK**\n' +
                `Every game requires an **Entry Fee** paid in ${SOULS_EMOJI} **Souls**.\n` +
                `The fee is **deducted from your wallet when you play**. You must have enough Souls to enter.\n\n` +
                `${SHARD_EMOJI} **1 Shard = 1,000 Souls worth**\n\n` +
                '**🌱 STARTER GAMES — LOW RISK**\n' +
                'Perfect for new members. Entry fees are low and Soul payouts are capped at **100 Souls**.\n\n' +
                '**Available Games**'
            )
            .addFields(
                {
                    name: `${SOULS_EMOJI} /quickcoin — Entry Fee: 20 Souls`,
                    value: `${SOULS_EMOJI} Heads vs ${TAILS_EMOJI} Tails — quick coin flip. **Win up to 100 Souls.**`,
                    inline: false,
                },
                {
                    name: '🎯 /quickguess — Entry Fee: 20 Souls',
                    value: 'Guess 1–3. **Win up to 100 Souls.**',
                    inline: false,
                },
                {
                    name: '🔴⚫ /redblack — Entry Fee: 25 Souls',
                    value: 'Guess Red or Black. **Win up to 100 Souls.**',
                    inline: false,
                },
                {
                    name: '✊ /rps — Entry Fee: 30 Souls',
                    value: 'Rock, Paper, Scissors against Niko. **Win up to 100 Souls.**',
                    inline: false,
                },
                {
                    name: '**💀 STANDARD GAMES**',
                    value:
                        `${SOULS_EMOJI} /soulflip — **100 Souls**\n` +
                        '🎲 /abyssdice — **250 Souls**\n' +
                        '🎰 /soulslots — **500 Souls**\n' +
                        '⬆️⬇️ /higherlower — **150 Souls**\n' +
                        '🎲 /diceduel — **300 Souls**\n' +
                        '🎯 /numberguess — **200 Souls**',
                    inline: false,
                },
                {
                    name: '🎁 Possible Results',
                    value:
                        `${SOULS_EMOJI} Common Souls\n` +
                        `${DOUBLE_SOULS_EMOJI} Double Souls\n` +
                        `${SHARD_EMOJI} **Ultra Rare Shard**\n` +
                        '💔 Better Luck Next Time',
                    inline: false,
                },
            )
            .setFooter({ text: `${TOTAL_SOULS_EMOJI} More games and higher-risk games coming soon.` });

        return interaction.reply({ embeds: [embed] });
    },
};
