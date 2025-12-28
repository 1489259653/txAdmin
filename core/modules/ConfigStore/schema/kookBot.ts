import { z } from "zod";
import { typeDefinedConfig, typeNullableConfig } from "./utils";
import { defaultEmbedConfigJson, defaultEmbedJson } from "@modules/KookBot/defaultJsons";
import { SYM_FIXER_DEFAULT } from "@lib/symbols";


const enabled = typeDefinedConfig({
    name: 'KOOK Bot 启用',
    default: false,
    validator: z.boolean(),
    fixer: SYM_FIXER_DEFAULT,
});

const token = typeNullableConfig({
    name: 'KOOK Bot Token',
    default: null,
    validator: z.string().min(1).nullable(),
    fixer: SYM_FIXER_DEFAULT,
});

const guildId = typeNullableConfig({
    name: '服务器 ID',
    default: null,
    validator: z.string().min(1).nullable(),
    fixer: SYM_FIXER_DEFAULT,
});

const warningsChannel = typeNullableConfig({
    name: '警告频道 ID',
    default: null,
    validator: z.string().min(1).nullable(),
    fixer: SYM_FIXER_DEFAULT,
});

const statusChannel = typeNullableConfig({
    name: '状态频道 ID',
    default: null,
    validator: z.string().min(1).nullable(),
    fixer: SYM_FIXER_DEFAULT,
});


// 我们不验证JSON的内容，只验证它是否为字符串
export const attemptMinifyJsonString = (input: string) => {
    try {
        return JSON.stringify(JSON.parse(input));
    } catch (error) {
        return input;
    }
};

const embedJson = typeDefinedConfig({
    name: '状态嵌入 JSON',
    default: defaultEmbedJson,
    validator: z.string().min(1).transform(attemptMinifyJsonString),
    // 注意：这里没有真正的验证，仅在模块中进行
    fixer: SYM_FIXER_DEFAULT,
});

const embedConfigJson = typeDefinedConfig({
    name: '状态配置 JSON',
    default: defaultEmbedConfigJson,
    validator: z.string().min(1).transform(attemptMinifyJsonString),
    // 注意：这里没有真正的验证，仅在模块中进行
    fixer: SYM_FIXER_DEFAULT,
});


export default {
    enabled,
    token,
    guildId,
    warningsChannel,
    statusChannel,
    embedJson,
    embedConfigJson,
} as const;