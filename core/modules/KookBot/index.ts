const modulename = 'KOOKBot';
import Kasumi from 'kasumi.js';
import { MessageType, PlainTextMessageEvent , MarkdownMessageEvent } from 'kasumi.js';
import { BaseCommand} from 'kasumi.js';
import consoleFactory from '@lib/console';
import { KookBotStatus } from '@shared/enums';
import { UpdateConfigKeySet } from '@modules/ConfigStore/utils';
import { embedColors } from './kookHelpers';
import {commands,menus} from './kookCommands';

const console = consoleFactory(modulename);


// Types
type MessageTranslationType = {
  key: string;
  data?: object;
}

type AnnouncementType = {
  title?: string | MessageTranslationType;
  description: string | MessageTranslationType;
  type: keyof typeof embedColors;
}

type SpawnConfig = Pick<
  TxConfigs['kookBot'],
  'enabled' | 'token' | 'guildId' | 'warningsChannel'
>;

/**
 * Module that handles the KOOK bot, provides methods to resolve members and send announcements, as well as
 * providing KOOK commands.
 */
export default class KookBot {
  // 模块配置监听
  static readonly configKeysWatched = [
    'kookBot.embedJson',
    'kookBot.embedConfigJson',
  ];

  // 客户端状态
  #client: Kasumi | undefined;
  #lastStatus = KookBotStatus.Disabled;
  #lastExplicitStatus = KookBotStatus.Disabled;
  #readyState: 'ready' | 'connecting' | 'disconnected' = 'disconnected';

  // 命令处理器
  #commands: Map<string, BaseCommand> = new Map();
  #commandPrefix: string = '/';

  // 服务器信息
  guild: any | undefined;
  guildName: string | undefined;
  announceChannel: any | undefined;

  constructor() {
    

    // 尝试启动Bot
    setImmediate(() => {
      if (txConfig.kookBot.enabled) {
        this.startBot()?.catch((e) => {
          console.error('KOOK Bot启动失败:', e);
        });
      }
    });

    // 定时任务
    setInterval(() => {
      if (txConfig.kookBot.enabled) {
        this.updateBotStatus().catch((e) => {
          console.error('更新KOOK Bot状态失败:', e);
        });
      }
    }, 60_000);

    // 刷新WebSocket状态
    setInterval(() => {
      this.refreshWsStatus();
    }, 7500);
  }

  /**
   * 初始化命令映射
   */
  #initializeCommands(): void {
    for (const command of commands) {
      this.#commands.set(command.name.toLowerCase(), command);
      if(this.#client){
        this.#client.plugin.load(command);   
      }
    }
    
    for (const menu of menus) {
        if(this.#client){
         this.#client.plugin.load(menu);
        }
    }
  }

  /**
   * 处理配置更新
   */
  public handleConfigUpdate(updatedConfigs: UpdateConfigKeySet): Promise<boolean> {
    return this.updateBotStatus();
  }

  /**
   * 通过设置保存调用，尝试使用新设置重新启动Bot
   */
  async attemptBotReset(botCfg: SpawnConfig | false): Promise<boolean> {
    if (this.#client) {
      console.warn('正在停止KOOK Bot');
      this.shutdownBot();
      setTimeout(() => {
        if (!botCfg || !botCfg.enabled) this.#client = undefined;
      }, 1000);
    }

    if (botCfg && botCfg.enabled) {
      return await this.startBot(botCfg) ? true : false;
    } else {
      return true;
    }
  }

  /**
   * 检查客户端是否就绪
   */
  get isClientReady() {
    return this.#readyState === 'ready';
  }

  /**
   * 获取客户端就绪状态
   */
  get readyState() {
    return this.#readyState;
  }

  /**
   * 获取Bot状态
   */
  get status(): KookBotStatus {
    if (!txConfig.kookBot.enabled) {
      return KookBotStatus.Disabled;
    } else if (this.isClientReady) {
      return KookBotStatus.Ready;
    } else {
      return this.#lastExplicitStatus;
    }
  }

  /**
   * 更新Bot状态并推送到WebSocket
   */
  refreshWsStatus(): void {
    if (this.#lastStatus !== this.status) {
      this.#lastStatus = this.status;
      txCore.webServer.webSocket.pushRefresh('status');
    }
  }

  /**
   * 发送公告到配置的频道
   */
  async sendAnnouncement(content: AnnouncementType): Promise<boolean> {
    if (!txConfig.kookBot.enabled) return false;
    if (
      !txConfig.kookBot.warningsChannel
      || !this.isClientReady
      || !this.announceChannel
    ) {
      console.verbose.warn('尚未准备好发送公告');
      return false;
    }

    try {
      let title;
      if (content.title) {
        title = (typeof content.title === 'string')
          ? content.title
          : txCore.translator.t(content.title.key, content.title.data);
      }

      let description;
      if (content.description) {
        description = (typeof content.description === 'string')
          ? content.description
          : txCore.translator.t(content.description.key, content.description.data);
      }

      // 构建KOOK卡片消息
      const cardMessage = [{
        type: 'card',
        theme: content.type || 'primary',
        color: embedColors[content.type] || '#ffffff',
        size: 'lg',
        modules: [
          {
            type: 'section',
            text: {
              type: 'kmarkdown',
              content: title || '',
            }
          },
          {
            type: 'section',
            text: {
              type: 'kmarkdown',
              content: description || ''
            }
          }
        ]
      }];

      await this.sendMessage(this.announceChannel.id, JSON.stringify(cardMessage));
      return true;
    } catch (error) {
      console.error(`发送KOOK公告错误: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 更新Bot状态
   */
  async updateBotStatus(): Promise<boolean> {
    if (!this.isClientReady) {
      console.verbose.warn('尚未准备好更新状态');
      return false;
    }

    try {
      // 这里可以添加更新Bot活动状态的逻辑
      const serverClients = txCore.fxPlayerlist.onlineCount;
      const serverMaxClients = txCore.cacheStore.get('fxsRuntime:maxClients') ?? '??';
      const serverName = txConfig.general.serverName;
      console.verbose.debug(`服务器状态: [${serverClients}/${serverMaxClients}] on ${serverName}`);

      // 更新状态消息（如果需要）
      const oldChannelId = txCore.cacheStore.get('kook:status:channelId');
      const oldMessageId = txCore.cacheStore.get('kook:status:messageId');

      if (typeof oldChannelId === 'string' && typeof oldMessageId === 'string') {
        try {
          // 这里可以添加更新状态消息的逻辑
          console.verbose.debug(`尝试更新状态消息: ${oldChannelId} ${oldMessageId}`);
        } catch (error) {
          console.verbose.warn(`更新状态消息失败: ${(error as Error).message}`);
        }
      }

      return true;
    } catch (error) {
      console.verbose.warn(`更新KOOK Bot状态失败: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 启动Bot
   */
  startBot(botCfg?: SpawnConfig): Promise<string | void> {
    const isConfigSaveAttempt = !!botCfg;
    botCfg ??= {
      enabled: txConfig.kookBot.enabled,
      token: txConfig.kookBot.token,
      guildId: txConfig.kookBot.guildId,
      warningsChannel: txConfig.kookBot.warningsChannel,
    };

    if (!botCfg.enabled) return Promise.resolve();

    return new Promise<string | void>(async (resolve, reject) => {
      type ErrorOptData = {
        code?: string;
        clientId?: string;
        prohibitedPermsInUse?: string[];
      };

      const sendError = (msg: string, data: ErrorOptData = {}) => {
        console.error(msg);
        const e = new Error(msg);
        Object.assign(e, data);
        console.warn('正在停止KOOK Bot');
        this.shutdownBot();
        setImmediate(() => {
          this.#lastExplicitStatus = KookBotStatus.Error;
          this.refreshWsStatus();
          this.#client = undefined;
        });
        return reject(e);
      };

      // 检查配置
      if (typeof botCfg.token !== 'string' || !botCfg.token.length) {
        return sendError('KOOK Bot已启用但未设置token');
      }

      if (typeof botCfg.guildId !== 'string' || !botCfg.guildId.length) {
        return sendError('KOOK Bot已启用但未设置服务器ID');
      }

      // 状态检查
      if (this.isClientReady) {
        console.verbose.warn('在重启前销毁客户端');
        this.shutdownBot();
      }

      // 设置状态
      this.#lastExplicitStatus = KookBotStatus.Starting;
      this.#readyState = 'connecting';
      this.refreshWsStatus();
      try {
        // 初始化kasumi客户端
        this.#client = new Kasumi({
          type: 'websocket',
          token: botCfg.token,
          disableSnOrderCheck: true,
        });

        // 注册就绪事件
        this.#client.on('connect.websocket', async () => {
          console.info('KOOK Bot已就绪');
          this.#readyState = 'ready';

          try {
            await this.#fetchGuildInfo(botCfg.guildId as string);

            if (botCfg.warningsChannel) {
              await this.#fetchAnnounceChannel(botCfg.warningsChannel);
            }

            const successMsg = botCfg.warningsChannel
              ? 'KOOK Bot已成功连接到服务器'
              : 'KOOK Bot已成功连接到服务器，但未设置公告频道';
            console.ok(successMsg);
            this.refreshWsStatus();

            if (!isConfigSaveAttempt) {
              this.updateBotStatus().catch((e) => {
                console.error('更新KOOK Bot状态失败:', e);
              });
            }

            resolve(successMsg);
          } catch (error) {
            sendError(`初始化失败: ${(error as Error).message}`);
          }
        });

        // 注册消息事件 - 捕获所有普通消息类型
        this.#client.on('message.text', (event: PlainTextMessageEvent | MarkdownMessageEvent) => {
          this.#handleMessageCreate(event);
        });



        // 初始化命令映射
       this.#initializeCommands();

        // 启动客户端
        await this.#client.connect();
        console.debug('KOOK Bot已连接');
      } catch (error) {
        sendError(`KOOK Bot连接失败: ${(error as Error).message}`);
      }
    });
  }

  /**
   * 处理消息创建事件
   */
  #handleMessageCreate(event: PlainTextMessageEvent | MarkdownMessageEvent): void {
    const { content, authorId, messageId } = event;

    const author = event.author;
    if (author?.bot) return;

    if (!content?.startsWith(this.#commandPrefix)) return;

    const args = content.slice(this.#commandPrefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase().trim();

    if (!commandName) return;

    const command = this.#commands.get(commandName);
    if (!command) {
      console.debug(`未找到命令: ${commandName}`);
      return;
    }
  }

  private isJSONString(str: string): boolean {
    if (typeof str !== 'string' || str.trim() === '') {
      return false;
    }
    try {
      const parsed = JSON.parse(str);
      return typeof parsed === 'object' && parsed !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * 发送消息到KOOK频道
   */
  public async sendMessage(channelId: string, content: string): Promise<string> {
    if (!this.isClientReady) {
      throw new Error('KOOK Bot未就绪');
    }
    
    const messageType = this.isJSONString(content) ? MessageType.CardMessage : MessageType.MarkdownMessage;
    const response = await this.#client!.API.message.create(messageType, channelId, content);

    if (response.err) {
      throw response.err;
    }

    console.verbose.debug(`已发送消息到KOOK频道 ${channelId}`);
    return response.data.msg_id;
  }

  /**
   * 删除KOOK频道中的消息
   */
  public async deleteMessage(messageId: string): Promise<void> {
    if (!this.isClientReady) {
      throw new Error('KOOK Bot未就绪');
    }

    const response = await this.#client!.API.message.delete(messageId);
    if (response.err) {
      throw response.err;
    }
    console.verbose.debug(`已删除KOOK消息 ${messageId}`);
  }

  /**
   * 编辑KOOK频道中的消息
   */
  public async editMessage(messageId: string, content: string): Promise<void> {
    if (!this.isClientReady) {
      throw new Error('KOOK Bot未就绪');
    }

    const response = await this.#client!.API.message.update(messageId, content);
    if (response.err) {
      throw response.err;
    }
    console.verbose.debug(`已编辑KOOK消息 ${messageId}`);
  }

  /**
   * 关闭Bot
   */
  private shutdownBot(): void {
    console.info('正在关闭KOOK Bot...');
    this.#readyState = 'disconnected';

    if (this.#client) {
      if (this.#client.websocket) {
        (this.#client.websocket as any).close();
      }
      this.#client = undefined;
    }
  }

  /**
   * 处理关闭
   */
  public handleShutdown(): void {
    this.shutdownBot();
  }

  /**
   * 获取服务器信息
   */
  async #fetchGuildInfo(guildId: string): Promise<void> {
    const response = await this.#client!.API.guild.view(guildId);
    if (response.err) {
      throw new Error(`无法获取服务器信息: ${response.err.message}`);
    }
    this.guild = response.data;
    this.guildName = this.guild.name;
  }

  /**
   * 获取公告频道
   */
  async #fetchAnnounceChannel(channelId: string): Promise<void> {
    const response = await this.#client!.API.channel.view(channelId);
    if (response.err) {
      throw new Error(`无法获取频道信息: ${response.err.message}`);
    }
    this.announceChannel = response.data;
  }
}