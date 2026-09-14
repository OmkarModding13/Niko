import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const SOULS_EMOJI = '<:Souls:1547510037621112894>';
const TOTAL_SOULS_EMOJI = '<:Total:1547545479628333086>';
const DOUBLE_SOULS_EMOJI = '<:DoubleSouls:1549009386389766264>';
const SHARD_EMOJI = '<:Shard:1548962748321374218>';

const DICE_EMOJI = '🎲';
const SLOTS_EMOJI = '🎰';
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
                '**Available Games**'
            )
            .addFields(
                {
                    name: `${SOULS_EMOJI} /soulflip — Entry Fee: 100 Souls`,
                    value: `${SOULS_EMOJI} Heads vs ${TAILS_EMOJI} Tails — choose your side and flip the Soul Coin.`,
                    inline: false,
                },
                {
                    name: `${DICE_EMOJI} /abyssdice — Entry Fee: 250 Souls`,
                    value: 'Roll the Abyss Dice and face your fate.',
                    inline: false,
                },
                {
                    name: `${SLOTS_EMOJI} /soulslots — Entry Fee: 500 Souls`,
                    value: 'Spin the Soul Slots and try your luck.',
                    inline: false,
                },
                {
                    name: '⬆️⬇️ /higherlower — Entry Fee: 150 Souls',
                    value: 'Guess whether the next number will be higher or lower.',
                    inline: false,
                },
                {
                    name: `${DICE_EMOJI} /diceduel — Entry Fee: 300 Souls`,
                    value: 'Roll against Niko. Highest roll wins.',
                    inline: false,
                },
                {
                    name: '🎯 /numberguess — Entry Fee: 200 Souls',
                    value: 'Guess the secret number from 1 to 10.',
                    inline: false,
                },
                {
                    name: '🎁 Possible Results',
                    value:
                        `${SOULS_EMOJI} Common Souls\n` +
                        `${DOUBLE_SOULS_EMOJI} Double Souls\n` +
                        `${SHARD_EMOJI} **Rare Shard**\n` +
                        '💔 Better Luck Next Time',
                    inline: false,
                },
            )
            .setFooter({ text: `${TOTAL_SOULS_EMOJI} Your wallet balance determines whether you can enter.` });

        return interaction.reply({ embeds: [embed] });
    },
};
