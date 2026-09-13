import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
    AttachmentBuilder
} from 'discord.js';

import { logger } from '../../utils/logger.js';

import {
    TitanBotError,
    ErrorTypes
} from '../../utils/errorHandler.js';

import {
    checkUserPermissions
} from '../../utils/permissionGuard.js';

import {
    addLevels,
    getLevelingConfig
} from '../../services/leveling/leveling.js';

import {
    createLevelUpImage
} from '../../services/leveling/levelUpImage.js';

import { createEmbed } from '../../utils/embeds.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';


export default {

    data: new SlashCommandBuilder()
        .setName('leveladd')
        .setDescription('Add levels to a user')

        .addUserOption((option) =>
            option
                .setName('user')
                .setDescription('The user to add levels to')
                .setRequired(true)
        )

        .addIntegerOption((option) =>
            option
                .setName('levels')
                .setDescription('Number of levels to add')
                .setRequired(true)
                .setMinValue(1)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        )

        .setDMPermission(false),

    category: 'Leveling',


    async execute(
        interaction,
        config,
        client
    ) {

        await InteractionHelper.safeDefer(
            interaction
        );


        /*
         * ==========================================
         * PERMISSION CHECK
         * ==========================================
         */

        const hasPermission =
            await checkUserPermissions(
                interaction,
                PermissionFlagsBits.ManageGuild,
                'You need ManageGuild permission to use this command.'
            );

        if (!hasPermission) {
            return;
        }


        /*
         * ==========================================
         * LEVELING CONFIG
         * ==========================================
         */

        const levelingConfig =
            await getLevelingConfig(
                client,
                interaction.guildId
            );

        if (!levelingConfig?.enabled) {

            await InteractionHelper.safeEditReply(
                interaction,
                {
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#f1c40f')
                            .setDescription(
                                'The leveling system is currently disabled on this server.'
                            )
                    ],

                    flags:
                        MessageFlags.Ephemeral
                }
            );

            return;
        }


        /*
         * ==========================================
         * GET TARGET
         * ==========================================
         */

        const targetUser =
            interaction.options.getUser(
                'user'
            );

        const levelsToAdd =
            interaction.options.getInteger(
                'levels'
            );


        /*
         * ==========================================
         * FETCH MEMBER
         * ==========================================
         */

        const member =
            await interaction.guild.members
                .fetch(targetUser.id)
                .catch(() => null);

        if (!member) {

            throw new TitanBotError(
                `User ${targetUser.id} not found in this guild`,

                ErrorTypes.USER_INPUT,

                'The specified user is not in this server.'
            );
        }


        /*
         * ==========================================
         * ADD LEVELS
         * ==========================================
         */

        const userData =
            await addLevels(
                client,
                interaction.guildId,
                targetUser.id,
                levelsToAdd
            );


        /*
         * ==========================================
         * LEVEL-UP IMAGE
         * ==========================================
         */

        try {

            const image =
                await createLevelUpImage(
                    member,
                    userData.level
                );


            const attachment =
                new AttachmentBuilder(
                    image,
                    {
                        name: 'level-up.png'
                    }
                );


            /*
             * Send image to the same channel
             * where the command was used.
             */

            await interaction.channel.send({
                content:
                    `🎉 <@${targetUser.id}> has reached **Level ${userData.level}!**`,

                files: [
                    attachment
                ]
            });

        } catch (error) {

            /*
             * Image failure must NEVER undo
             * the successful level change.
             */

            logger.warn(
                `[LevelUp] Failed to send level-up image for ${targetUser.tag}:`,
                error
            );
        }


        /*
         * ==========================================
         * COMMAND RESULT
         * ==========================================
         */

        await InteractionHelper.safeEditReply(
            interaction,
            {
                embeds: [
                    createEmbed({
                        title:
                            'Levels Added',

                        description:
                            `Successfully added ${levelsToAdd} levels to ${targetUser.tag}.\n**New Level:** ${userData.level}`,

                        color:
                            'success'
                    })
                ]
            }
        );


        /*
         * ==========================================
         * LOG
         * ==========================================
         */

        logger.info(
            `[ADMIN] User ${interaction.user.tag} added ${levelsToAdd} levels to ${targetUser.tag} in guild ${interaction.guildId}`
        );
    }
};
