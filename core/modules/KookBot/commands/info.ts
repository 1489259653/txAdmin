const modulename = 'KOOKBot:cmd:info';
import { parsePlayerId } from '@lib/player/idUtils';
import { findPlayersByIdentifier } from '@lib/player/playerFinder';
import { txEnv } from '@core/globalData';
import { msToShortishDuration } from '@lib/misc';
import consoleFactory from '@lib/console';
import Logger from "bunyan";
import { BaseCommand, BaseMenu, BaseSession } from 'kasumi.js';

const console = consoleFactory(modulename);

/**
 * 时间戳转换为本地化日期
 */
const tsToLocaleDate = (ts: number): string => {
  return new Date(ts * 1000).toLocaleDateString(
    txCore.translator.canonical,
    { dateStyle: 'long' }
  );
};

/**
 * 处理self子命令 - 显示自己的信息
 */
const handleSelfSubcommand = async (session: BaseSession): Promise<void> => {
  try {
    const searchId = `kook:${session.authorId}`;
    await searchAndDisplayPlayerInfo(session, searchId, true);
  } catch (error) {
    console.error('处理self子命令失败:', (error as Error).message);
    await session.reply(`处理命令时发生错误: ${(error as Error).message}`);
  }
};

/**
 * 处理member子命令 - 显示指定成员的信息
 */
const handleMemberSubcommand = async (session: BaseSession, args: string[]): Promise<void> => {
  try {
    if (args.length < 1) {
      await session.reply('用法: /info member [成员ID]');
    }

    const memberId = args[0];
    const searchId = `kook:${memberId}`;
    await searchAndDisplayPlayerInfo(session, searchId, true);
  } catch (error) {
    console.error('处理member子命令失败:', (error as Error).message);
    await session.reply(`处理命令时发生错误: ${(error as Error).message}`);
  }
};

/**
 * 处理id子命令 - 显示指定标识符的玩家信息
 */
const handleIdSubcommand = async (session: BaseSession, args: string[]): Promise<void> => {
  try {
    if (args.length < 1) {
      await session.reply('用法: /info id [玩家标识符]');
    }

    const input = args[0].trim();
    if (!input.length) {
      await session.reply('无效的标识符。');
    }

    const { isIdValid, idlowerCased } = parsePlayerId(input);
    if (!isIdValid || !idlowerCased) {
      await session.reply(`提供的标识符(\`${input}\`)似乎无效。`);
    }

    const includeAdminInfo = args.length > 1 && args[1].toLowerCase() === 'admininfo';
    await searchAndDisplayPlayerInfo(session, idlowerCased as string, includeAdminInfo);
  } catch (error) {
    console.error('处理id子命令失败:', (error as Error).message);
    await session.reply(`处理命令时发生错误: ${(error as Error).message}`);
  }
};

/**
 * 搜索并显示玩家信息
 */
const searchAndDisplayPlayerInfo = async (
  session: BaseSession,
  searchId: string,
  includeAdminInfo: boolean = false
): Promise<void> => {
  try {
    // 搜索玩家
    const players = findPlayersByIdentifier(searchId);
    if (!players.length) {
      await session.reply(`标识符(\`${searchId}\`)似乎未关联到txAdmin数据库中的任何玩家。`);
    } else if (players.length > 10) {
      await session.reply(`标识符(\`${searchId}\`)关联了超过10名玩家，请使用txAdmin Web面板进行搜索。`);
    }

    // 为每个玩家构建信息
    for (const player of players) {
      const dbData = player.getDbData();
      if (!dbData) continue;

      // 基本数据
      const infoParts: string[] = [`**玩家信息: ${player.displayName}**`, ''];

      const basicInfo = {
        '游戏时长': msToShortishDuration(dbData.playTime * 60 * 1000),
        '加入日期': tsToLocaleDate(dbData.tsJoined),
        '最后连接': tsToLocaleDate(dbData.tsLastConnection),
        '白名单状态': dbData.tsWhitelisted ? tsToLocaleDate(dbData.tsWhitelisted) : '尚未白名单'
      };

      // 添加基本信息
      Object.entries(basicInfo).forEach(([label, value]) => {
        infoParts.push(`• **${label}**: \`${value}\``);
      });

      // 如果需要管理员信息
      if (includeAdminInfo) {
        // 统计封禁/警告次数
        const actionHistory = player.getHistory();
        const actionCount = { ban: 0, warn: 0 };
        for (const log of actionHistory) {
          actionCount[log.type]++;
        }
        const banText = actionCount.ban === 1 ? '1次封禁' : `${actionCount.ban}次封禁`;
        const warnText = actionCount.warn === 1 ? '1次警告' : `${actionCount.warn}次警告`;
        infoParts.push(`• **记录**: \`${banText}, ${warnText}\``);

        // 添加备注和标识符
        const notesText = dbData.notes ? dbData.notes.text : '无';
        const idsText = dbData.ids.length ? dbData.ids.join('\n') : '无';
        infoParts.push('', '**备注**:', `\`\`\`${notesText}\`\`\``, '**标识符**:', `\`\`\`${idsText}\`\`\``);
      }

      // 发送信息
      await session.reply(infoParts.join('\n'));
    }
  } catch (error) {
    console.error('搜索并显示玩家信息失败:', (error as Error).message);
    throw error;
  }
};

/**
 * 处理/info命令 - 显示机器人信息
 */
const handleBotInfo = async (session: BaseSession): Promise<void> => {
  try {
    // 获取txAdmin版本信息
    const txAdminVersion = txEnv?.fxsVersion || '未知';

    // 构建信息消息
    const message = [
      '**txAdmin KOOK Bot 信息**',
      '',
      `• **txAdmin版本**: ${txAdminVersion}`,
      `• **Bot版本**: 1.0.0`,
      '',
      '**可用命令**:',
      '• /status - 查看服务器状态',
      '• /whitelist [member|request|list] - 管理白名单',
      '• /info - 查看机器人信息',
      '• /info self - 查看自己的游戏信息',
      '• /info member [成员ID] - 查看指定成员的游戏信息',
      '• /info id [玩家标识符] - 查看指定标识符的玩家信息'
    ].join('\n');

    await session.reply(message);
  } catch (error) {
    console.error('获取机器人信息失败:', (error as Error).message);
    throw error;
  }
};

export class InfoMenu extends BaseMenu {
  name = 'info';
  description = '查看信息';


}

export class SelfInfoCommand extends BaseCommand {
  name = 'self';
  description = '查看自己的游戏信息';
  async func(session: BaseSession): Promise<void> {
    handleSelfSubcommand(session);
  }
}

export class MemberInfoCommand extends BaseCommand {
  name = 'member';
  description = '查看指定成员的游戏信息';
  async func(session: BaseSession): Promise<void> {
    const args = session.args;
    handleMemberSubcommand(session, args);
  }
}

export class IdInfoCommand extends BaseCommand {
  name = 'id';
  description = '查看指定标识符的玩家信息';
  async func(session: BaseSession): Promise<void> {
    const args = session.args;
    handleIdSubcommand(session, args);
  }
}

export class BotInfoCommand extends BaseCommand {
  name = 'bot';
  description = '查看机器人信息';
  async func(session: BaseSession): Promise<void> {
    handleBotInfo(session);
  }
}
/**
 * Handler for /info
 */
export const infoMenu = new InfoMenu(new SelfInfoCommand(), 
  new MemberInfoCommand(), 
  new IdInfoCommand(),
  new BotInfoCommand());