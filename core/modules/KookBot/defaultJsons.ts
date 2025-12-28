import { txEnv } from "@core/globalData";

export const defaultEmbedJson = JSON.stringify([
  {
    "type": "card",
    "theme": "secondary",
    "size": "lg",
    "modules": [
      {
        "type": "section",
        "text": {
          "type": "kmarkdown",
          "content": "**{{serverName}}**"
        }
      },
      {
        "type": "section",
        "text": {
          "type": "plain-text",
          "content": "您可以在 txAdmin > 设置 > KOOK机器人 中配置此卡片消息"
        }
      },
      {
        "type": "section",
        "text": {
          "type": "paragraph",
          "cols": 2,
          "fields": [
            {
              "type": "kmarkdown",
              "content": "**> 服务器状态**\n```\n{{statusString}}\n```"
            },
            {
              "type": "kmarkdown",
              "content": "**> 在线玩家**\n```\n{{serverClients}}/{{serverMaxClients}}\n```"
            }
          ]
        }
      },
      {
        "type": "section",
        "text": {
          "type": "kmarkdown",
          "content": "**> F8 连接命令**\n```\nconnect 123.123.123.123\n```"
        }
      },
      {
        "type": "section",
        "text": {
          "type": "paragraph",
          "cols": 2,
          "fields": [
            {
              "type": "kmarkdown",
              "content": "**> 下次重启**\n```\n{{nextScheduledRestart}}\n```"
            },
            {
              "type": "kmarkdown",
              "content": "**> 运行时间**\n```\n{{uptime}}\n```"
            }
          ]
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "section",
        "mode": "right",
        "accessory": {
          "type": "image",
          "src": "https://forum-cfx-re.akamaized.net/original/5X/e/e/c/b/eecb4664ee03d39e34fcd82a075a18c24add91ed.png",
          "size": "lg"
        }
      }
    ]
  }
]);

export const defaultEmbedConfigJson = JSON.stringify({
  "onlineString": "🟢 在线",
  "onlineColor": "#0BA70B",
  "partialString": "🟡 部分可用",
  "partialColor": "#FFF100",
  "offlineString": "🔴 离线",
  "offlineColor": "#A70B28",
  "buttons": [
    {
      "emoji": "🎮",
      "label": "连接服务器",
      "url": "{{serverJoinUrl}}"
    },
    {
      "emoji": "🔧",
      "label": "txAdmin 官网",
      "url": "https://github.com/tabarra/txAdmin"
    },
    txEnv.displayAds ? {
      "emoji": "😏",
      "label": "ZAP-Hosting",
      "url": "https://zap-hosting.com/txadmin6"
    } : undefined
  ].filter(Boolean)
});
