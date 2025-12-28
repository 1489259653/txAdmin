const modulename = 'KOOKBot:cmd:whitelist';
import { now } from '@lib/misc';
import { DuplicateKeyError } from '@modules/Database/dbUtils';
import consoleFactory from '@lib/console';
import KookBot from '../index';
import { BaseCommand, BaseMenu, BaseSession } from 'kasumi.js';
const console = consoleFactory(modulename);

/**
 * Command /whitelist member <mention>
 */
const handleMemberSubcommand = async (session: BaseSession, args: string[], adminName: string) => {
  try {
    if (args.length < 1) {
      return await session.reply('用法: /whitelist member [成员ID]');
    }

    const memberId = args[0];
    const identifier = `kook:${memberId}`;
    const playerName = memberId; // 由于没有获取成员昵称的API，暂时使用ID

    // 注册批准
    try {
      txCore.database.whitelist.registerApproval({
        identifier,
        playerName,
        playerAvatar: null, // KOOK API中没有直接获取头像的方式
        tsApproved: now(),
        approvedBy: adminName,
      });
      txCore.fxRunner.sendEvent('whitelistPreApproval', {
        action: 'added',
        identifier,
        playerName,
        adminName,
      });
    } catch (error) {
      if (error instanceof DuplicateKeyError) {
        return await session.reply(`成员 ${memberId} 已经在白名单中`);
      }
      return await session.reply(`保存白名单批准失败: ${(error as Error).message}`);
    }

    const msg = `已添加 ${memberId} 到白名单。`;
    logKookAdminAction(adminName, msg);
    return await session.reply(msg);
  } catch (error) {
    console.error('处理成员子命令失败:', (error as Error).message);
    return await session.reply(`处理命令时发生错误: ${(error as Error).message}`);
  }
};

/**
 * Command /whitelist request <id>
 */
const handleRequestSubcommand = async (session: BaseSession, args: string[], adminName: string) => {
  try {
    if (args.length < 1) {
      return await session.reply('用法: /whitelist request [请求ID]');
    }

    const reqId = args[0].trim().toUpperCase();
    if (reqId.length !== 5 || reqId[0] !== 'R') {
      return await session.reply('无效的请求ID。');
    }
    // 查找请求
    const requests = txCore.database.whitelist.findManyRequests({ id: reqId });
    if (!requests.length) {
      return await session.reply(`未找到白名单请求ID \`${reqId}\``);
    }
    const req = requests[0]; // 只获取第一个

    // 注册白名单批准
    const identifier = `license:${req.license}`;
    const playerName = req.discordTag ?? req.playerDisplayName;
    try {
      txCore.database.whitelist.registerApproval({
        identifier,
        playerName,
        playerAvatar: req.discordAvatar || null,
        tsApproved: now(),
        approvedBy: adminName,
      });
      txCore.fxRunner.sendEvent('whitelistRequest', {
        action: 'approved',
        playerName,
        requestId: req.id,
        license: req.license,
        adminName,
      });
    } catch (error) {
      if (!(error instanceof DuplicateKeyError)) {
        return await session.reply(`保存白名单批准失败: ${(error as Error).message}`);
      }
    }

    // 从白名单请求中移除记录
    try {
      txCore.database.whitelist.removeManyRequests({ id: reqId });
    } catch (error) {
      return await session.reply(`移除白名单请求失败: ${(error as Error).message}`);
    }

    const msg = `已批准白名单请求 \`${reqId}\` 来自 ${playerName}。`;
    logKookAdminAction(adminName, msg);
    return await session.reply(msg);
  } catch (error) {
    console.error('处理请求子命令失败:', (error as Error).message);
    return await session.reply(`处理命令时发生错误: ${(error as Error).message}`);
  }
};

/**
 * 列出白名单玩家
 */
const handleListSubcommand = async (session: BaseSession) => {
  try {
    // 获取白名单玩家列表
    const whitelist = txCore.database.whitelist.findManyApprovals({});

    if (!whitelist.length) {
      return await session.reply('白名单为空');
    }

    // 构建白名单列表消息
    const messageParts = ['**白名单列表**', ''];

    // 限制显示数量，防止消息过长
    const maxDisplay = 20;
    const displayCount = Math.min(whitelist.length, maxDisplay);

    for (let i = 0; i < displayCount; i++) {
      const player = whitelist[i];
      const addedDate = new Date(player.tsApproved * 1000).toLocaleString('zh-CN');
      messageParts.push(`• ${player.identifier} - ${player.approvedBy || '系统'} (添加于: ${addedDate})`);
    }

    if (whitelist.length > maxDisplay) {
      messageParts.push(`\n... 还有 ${whitelist.length - maxDisplay} 个玩家未显示`);
    }

    messageParts.push(`\n总计: ${whitelist.length} 个玩家`);

    // 发送消息
    return await session.reply(messageParts.join('\n'));
  } catch (error) {
    console.error('获取白名单列表失败:', (error as Error).message);
    return await session.reply(`获取白名单列表失败: ${(error as Error).message}`);
  }
};

/**
 * 记录KOOK管理员操作
 */
const logKookAdminAction = (adminName: string, message: string) => {
  console.info(`${adminName}: ${message}`);
  txCore.logger.admin.write('KOOK Bot', `${adminName}: ${message}`);
};

/**
 * 检查管理员权限
 */
const ensurePermission = async (authorId: string): Promise<string | null> => {
  try {
    // 这里应该实现KOOK的权限检查逻辑
    // 简化版：假设所有使用此命令的用户都有管理员权限
    // 实际应用中应该根据KOOK的权限系统进行验证
    const adminName = `KOOK用户(${authorId})`;
    return adminName;
  } catch (error) {
    console.error('权限检查失败:', (error as Error).message);
    return null;
  }
};

export class MemberCommand extends BaseCommand {
  name = 'member';
  description = '添加玩家白名单状态';
  async func(session: BaseSession): Promise<void> {
    const args = session.args;
    const adminName = await ensurePermission(session.authorId);
    if (!adminName) {
      await session.reply('您没有权限执行此命令');
      return
    }
    await handleMemberSubcommand(session, args, adminName);
  }
}

export class RequestCommand extends BaseCommand {
  name = 'request';
  description = '查看白名单请求';
  async func(session: BaseSession): Promise<void> {
    const args = session.args;
    const adminName = await ensurePermission(session.authorId);
    if (!adminName) {
      await session.reply('您没有权限执行此命令');
      return
    }
    await handleRequestSubcommand(session, args, adminName);
  }
}

/**
 * Handler for /whitelist
 */
export class ListCommand extends BaseCommand {
  name = 'list';
  description = '查看白名单玩家';
  async func(session: BaseSession): Promise<void> {
    const adminName = await ensurePermission(session.authorId);
    if (!adminName) {
      await session.reply('您没有权限执行此命令');
      return
    }
    await handleListSubcommand(session);
  }
}

export class WhiteListMenu extends BaseMenu {
  name = 'whitelist';
  description = '白名单管理';
}
export const whiteListMenu = new WhiteListMenu(
  new MemberCommand(),
  new RequestCommand(),
  new ListCommand(),
);
