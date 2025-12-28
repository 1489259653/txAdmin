/**
 * KOOK Bot 命令定义
 */
import { BaseSession, BaseCommand, BaseMenu } from 'kasumi.js';
import { Card } from 'kasumi.js';
import { infoMenu } from './commands/info';
/**
 * ping 命令 - 检查机器人是否在线
 */
class PingCommand extends BaseCommand {
  name = 'ping';
  description = '检查机器人是否在线';
  async func(session: BaseSession): Promise<void> {
    session.reply('pong! 机器人在线');
  }
}

/**
 * status 命令 - 显示服务器状态信息
 */
class StatusCommand extends BaseCommand {
  name = 'status';
  description = '显示服务器状态信息';
  async func(session: BaseSession): Promise<void> {
    try {
      const serverClients = txCore.fxPlayerlist.onlineCount;
      const serverMaxClients = txCore.cacheStore.get('fxsRuntime:maxClients') ?? '??';
      const serverName = txConfig.general.serverName;
      const statusCard = new Card();
      statusCard.addText(`服务器名: ${serverName}`);
      statusCard.addText(`在线玩家: ${serverClients}/${serverMaxClients}`);

      await session.reply(statusCard);
    } catch (error) {
      await session.reply(`获取服务器状态失败: ${(error as Error).message}`);
    }
  }
};

/**
 * 帮助命令 - 显示所有可用命令
 */
class HelpCommand extends BaseCommand {
  name = 'help';
  description = '显示所有可用命令';
  async func(session: BaseSession): Promise<void> {
    const commandList = commands.map(cmd => `/${cmd.name} - ${cmd.description}`).join('\n');

    const helpMessage = new Card()
    helpMessage.addText('**可用命令列表:**');
    helpMessage.addText(commandList);
    

    await session.reply(helpMessage);
  }
};

/**
 * 导出所有命令
 */
export const commands: BaseCommand[] = [
  new PingCommand(),
  new StatusCommand(),
  new HelpCommand()
];
export const menus: BaseMenu[] = [
  infoMenu,
];
