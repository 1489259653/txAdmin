const modulename = 'KOOKBot:cmd:status';
import { txEnv } from '@core/globalData';
import { cloneDeep } from 'lodash-es';
import { ensurePermission, logKookAdminAction, embedder } from '../kookHelpers';
import consoleFactory from '@lib/console';
import { msToShortishDuration } from '@lib/misc';
import { FxMonitorHealth } from '@shared/enums';
import KookBot from '../index';

const console = consoleFactory(modulename);

// 验证按钮配置
const isValidButtonConfig = (btn: any) => {
  const btnType = typeof btn;
  return (
    btn !== null && btnType === 'object'
    && typeof btn.label === 'string'
    && btn.label.length
    && typeof btn.url === 'string'
    && (typeof btn.emoji === 'string' || btn.emoji === undefined)
  );
};

// 无效URL消息
const invalidUrlMessage = `Every URL must start with one of (\`http://\`, \`https://\`, \`discord://\`).
URLs cannot be empty, if you do not want a URL then remove the URL line.`;

// 无效占位符消息
const invalidPlaceholderMessage = `Your URL starts with \`{{\`, try removing it.
If you just tried to edit a placeholder like \`{{serverBrowserUrl}}\` or \`{{serverJoinUrl}}\`, remember that those placeholders are replaced automatically by txAdmin, meaning you do not need to edit them at all.`;

// 生成状态消息
export const generateStatusMessage = (
  rawEmbedJson: string = txConfig.kookBot.embedJson,
  rawEmbedConfigJson: string = txConfig.kookBot.embedConfigJson
) => {
  // 解析JSON
  let embedJson;
  try {
    embedJson = JSON.parse(rawEmbedJson);
    if (!(embedJson instanceof Object)) throw new Error(`not an Object`);
  } catch (error) {
    throw new Error(`Embed JSON Error: ${(error as Error).message}`);
  }

  let embedConfigJson;
  try {
    embedConfigJson = JSON.parse(rawEmbedConfigJson);
    if (!(embedConfigJson instanceof Object)) throw new Error(`not an Object`);
  } catch (error) {
    throw new Error(`Embed Config JSON Error: ${(error as Error).message}`);
  }

  // 准备占位符
  const serverCfxId = txCore.cacheStore.get('fxsRuntime:cfxId');
  const fxMonitorStatus = txCore.fxMonitor.status;
  const placeholders = {
    serverName: txConfig.general.serverName,
    statusString: 'Unknown',
    statusColor: '#4C3539',
    serverCfxId,
    serverBrowserUrl: `https://servers.fivem.net/servers/detail/${serverCfxId}`,
    serverJoinUrl: `https://cfx.re/join/${serverCfxId}`,
    serverMaxClients: txCore.cacheStore.get('fxsRuntime:maxClients') ?? 'unknown',
    serverClients: txCore.fxPlayerlist.onlineCount,
    nextScheduledRestart: 'unknown',
    uptime: (fxMonitorStatus.uptime > 0)
      ? msToShortishDuration(fxMonitorStatus.uptime)
      : '--',
  };

  // 准备计划任务占位符
  const schedule = txCore.fxScheduler.getStatus();
  if (typeof schedule.nextRelativeMs !== 'number') {
    placeholders.nextScheduledRestart = 'not scheduled';
  } else if (schedule.nextSkip) {
    placeholders.nextScheduledRestart = 'skipped';
  } else {
    const tempFlag = (schedule.nextIsTemp) ? '(tmp)' : '';
    const relativeTime = msToShortishDuration(schedule.nextRelativeMs);
    const isLessThanMinute = schedule.nextRelativeMs < 60_000;
    if (isLessThanMinute) {
      placeholders.nextScheduledRestart = `right now ${tempFlag}`;
    } else {
      placeholders.nextScheduledRestart = `in ${relativeTime} ${tempFlag}`;
    }
  }

  // 准备状态占位符
  if (fxMonitorStatus.health === FxMonitorHealth.ONLINE) {
    placeholders.statusString = embedConfigJson?.onlineString ?? '🟢 Online';
    placeholders.statusColor = embedConfigJson?.onlineColor ?? "#0BA70B";
  } else if (fxMonitorStatus.health === FxMonitorHealth.PARTIAL) {
    placeholders.statusString = embedConfigJson?.partialString ?? '🟡 Partial';
    placeholders.statusColor = embedConfigJson?.partialColor ?? "#FFF100";
  } else if (fxMonitorStatus.health === FxMonitorHealth.OFFLINE) {
    placeholders.statusString = embedConfigJson?.offlineString ?? '🔴 Offline';
    placeholders.statusColor = embedConfigJson?.offlineColor ?? "#A70B28";
  }

  // 处理占位符替换
  function replacePlaceholders(inputString: string) {
    Object.entries(placeholders).forEach(([key, value]) => {
      inputString = inputString.replaceAll(`{{${key}}}`, String(value));
    });
    return inputString;
  }

  // 处理值
  function processValue(inputValue: any): any {
    if (typeof inputValue === 'string') {
      return replacePlaceholders(inputValue);
    } else if (Array.isArray(inputValue)) {
      return inputValue.map((arrValue) => processValue(arrValue));
    } else if (inputValue !== null && typeof inputValue === 'object') {
      return processObject(inputValue);
    } else {
      return inputValue;
    }
  }

  // 处理对象
  function processObject(inputData: object) {
    const input = cloneDeep(inputData);
    const out: any = {};
    for (const [key, value] of Object.entries(input)) {
      const processed = processValue(value);
      // URL验证逻辑（简化版）
      if (key === 'url' && processed.length && !processed.startsWith('http')) {
        const messageHead = processed.startsWith('{{')
          ? invalidPlaceholderMessage
          : invalidUrlMessage;
        throw new Error(messageHead);
      }
      out[key] = processed;
    }
    return out;
  }

  // 处理嵌入数据
  const processedEmbedData = processObject(embedJson);

  // 格式化KOOK消息
  let formattedMessage = '';
  if (processedEmbedData.title) {
    formattedMessage += `**${processedEmbedData.title}**\n`;
  }
  if (processedEmbedData.description) {
    formattedMessage += `${processedEmbedData.description}\n`;
  }
  if (processedEmbedData.fields) {
    processedEmbedData.fields.forEach((field: any) => {
      formattedMessage += `\n**${field.name}**:\n${field.value}`;
    });
  }
  formattedMessage += `\n\nUpdated every minute • txAdmin ${txEnv.txaVersion}`;

  // 处理按钮
  let buttons = [];
  if (Array.isArray(embedConfigJson?.buttons) && embedConfigJson.buttons.length) {
    if (embedConfigJson.buttons.length > 5) {
      throw new Error(`Over limit of 5 buttons.`);
    }
    for (const cfgButton of embedConfigJson.buttons) {
      if (!isValidButtonConfig(cfgButton)) {
        throw new Error(`Invalid button in Kook Status Embed Config.\nAll buttons must have:\n- Label: string, not empty\n- URL: string, not empty, valid URL`);
      }
      const processedUrl = processValue(cfgButton.url);
      if (processedUrl.length && !processedUrl.startsWith('http')) {
        throw new Error(`Invalid URL \`${processedUrl}\` for button \`${cfgButton.label}\`.`);
      }
      buttons.push({
        label: processValue(cfgButton.label),
        url: processedUrl,
        emoji: cfgButton.emoji,
      });
    }
  }

  return {
    content: formattedMessage,
    buttons: buttons.length ? buttons : undefined,
  };
};

// 移除旧的状态消息
export const removeOldEmbed = async (bot: KookBot) => {
  const oldChannelId = txCore.cacheStore.get('kook:status:channelId');
  const oldMessageId = txCore.cacheStore.get('kook:status:messageId');
  if (typeof oldChannelId === 'string' && typeof oldMessageId === 'string') {
    try {
      await bot.deleteMessage(oldChannelId, oldMessageId);
    } catch (error) {
      throw new Error(`Failed to delete old message: ${(error as Error).message}`);
    }
  } else {
    throw new Error(`No old message id saved, maybe was never sent, maybe it was removed`);
  }
};

// 主要处理函数
export default async (bot: KookBot, authorId: string, channelId: string, subcommand?: string) => {
  // 检查权限
  const adminName = await ensurePermission(bot, authorId, 'settings.write');
  if (typeof adminName !== 'string') return;

  // 尝试移除旧消息
  const isRemoveOnly = (subcommand === 'remove');
  try {
    await removeOldEmbed(bot);
    txCore.cacheStore.delete('kook:status:channelId');
    txCore.cacheStore.delete('kook:status:messageId');
    if (isRemoveOnly) {
      const msg = `Old status embed removed.`;
      logKookAdminAction(adminName, msg);
      return await bot.sendMessage(channelId, embedder.success(msg, true));
    }
  } catch (error) {
    if (isRemoveOnly) {
      return await bot.sendMessage(
        channelId, 
        embedder.warning(`**Failed to remove old status embed:**\n${(error as Error).message}`, true)
      );
    }
  }

  // 生成新消息
  let newStatusMessage;
  try {
    newStatusMessage = generateStatusMessage();
  } catch (error) {
    return await bot.sendMessage(
      channelId, 
      embedder.warning(`**Failed to generate new embed:**\n${(error as Error).message}`, true)
    );
  }

  // 尝试发送新消息
  try {
    // 发送占位符消息
    const placeholderMessage = '_placeholder message, attempting to edit with embed..._\n**Note:** If you are seeing this message, it probably means that something was wrong with the configured Embed JSONs.';
    const placeholderMsg = await bot.sendMessage(channelId, placeholderMessage);
    const messageId = placeholderMsg?.msg_id || '';

    // 编辑为正式消息
    await bot.editMessage(channelId, messageId, newStatusMessage.content, newStatusMessage.buttons);
    txCore.cacheStore.set('kook:status:channelId', channelId);
    txCore.cacheStore.set('kook:status:messageId', messageId);
  } catch (error) {
    let msg: string;
    if ((error as any).code === 50013) {
      msg = `This bot does not have permission to send embed messages in this channel.\nPlease change the channel permissions and give this bot the required permissions.`;
    } else {
      msg = (error as Error).message;
    }
    return await bot.sendMessage(
      channelId, 
      embedder.warning(`**Failed to send new embed:**\n${msg}`, true)
    );
  }

  const msg = `Status embed saved.`;
  logKookAdminAction(adminName, msg);
  return await bot.sendMessage(channelId, embedder.success(msg, true));
};