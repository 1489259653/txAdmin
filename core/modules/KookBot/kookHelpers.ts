import orderedEmojis from 'unicode-emoji-json/data-ordered-emoji';
import consoleFactory from '@lib/console';
const modulename = 'KOOKBot:helpers';
const console = consoleFactory(modulename);
const allEmojis = new Set(orderedEmojis);
import KookBot from './index';

/**
 * Generic message generation functions for KOOK
 */
const genericMessage = (
    msg: string,
    ephemeral = false,
    emoji?: string
): string => {
    return emoji ? `${emoji} ${msg}` : msg;
};

export const embedColors = {
    info: '#1D76C9',
    success: '#0BA70B',
    warning: '#FFF100',
    danger: '#A70B28',
} as const;

export const embedder = {
    generic: genericMessage,
    info: (msg: string, ephemeral = false) => genericMessage(msg, ephemeral, 'ℹ️'),
    success: (msg: string, ephemeral = false) => genericMessage(msg, ephemeral, '✅'),
    warning: (msg: string, ephemeral = false) => genericMessage(msg, ephemeral, '⚠️'),
    danger: (msg: string, ephemeral = false) => genericMessage(msg, ephemeral, '❌'),
};

/**
 * Ensure that the KOOK message author has the required permission
 */
export const ensurePermission = async (bot: KookBot, authorId: string, reqPerm: string) => {
    const admin = txCore.adminStore.getAdminByProviderUID(authorId);
    if (!admin) {
        await bot.sendMessage(authorId, embedder.warning(`**Your account does not have txAdmin access.** 🧐\nIf you are already registered in txAdmin, visit the Admin Manager page, and make sure the KOOK ID for your user is set to \`${authorId}\`.`, true));
        return false;
    }
    if (
        admin.master !== true
        && !admin.permissions.includes('all_permissions')
        && !admin.permissions.includes(reqPerm)
    ) {
        //@ts-ignore: not important
        const permName = txCore.adminStore.registeredPermissions[reqPerm] ?? 'Unknown';
        await bot.sendMessage(authorId, embedder.danger(`Your txAdmin account does not have the "${permName}" permissions required for this action.`, true));
        return false;
    }

    return admin.name;
};

/**
 * Equivalent to ctx.admin.logAction() for KOOK
 */
export const logKookAdminAction = async (adminName: string, message: string) => {
    txCore.logger.admin.write(adminName, message);
};

/**
 * Tests if an embed url is valid or not
 */
export const isValidEmbedUrl = (url: unknown) => {
    return typeof url === 'string' && /^(https?|discord):\/\//.test(url);
};

/**
 * Tests if an emoji STRING is valid or not for KOOK buttons.
 * Acceptable options:
 * - UTF-8 emoji ('😄')
 * - Valid emoji ID (KOOK-specific format)
 */
export const isValidButtonEmoji = (emoji: unknown) => {
    if (typeof emoji !== 'string') return false;
    // Check for KOOK emoji ID format (simplified version)
    if (/^\d+$/.test(emoji)) return true;
    // Check for custom emoji format similar to Discord
    if (/^<a?:\w{2,32}:\d{17,19}>$/.test(emoji)) return true;
    // Check for standard Unicode emojis
    return allEmojis.has(emoji);
};