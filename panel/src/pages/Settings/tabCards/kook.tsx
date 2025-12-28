import React, { useState, useReducer, useEffect, useMemo, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import {
  SettingsCardProps,
  getConfigAccessors,
  getPageConfig,
  getConfigDiff,
  configsReducer,
  getConfigEmptyState,
  SYM_RESET_CONFIG,
  PageConfigReducerAction,
} from '../utils';

const attemptBeautifyJsonString = (input: string): string => {
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return input;
  }
};

export const pageConfigs = {
  enabled: getPageConfig('kookBot', 'enabled'),
  token: getPageConfig('kookBot', 'token'),
  guildId: getPageConfig('kookBot', 'guildId'),
  warningsChannel: getPageConfig('kookBot', 'warningsChannel'),
  statusChannel: getPageConfig('kookBot', 'statusChannel'),
  embedJson: getPageConfig('kookBot', 'embedJson', true),
  embedConfigJson: getPageConfig('kookBot', 'embedConfigJson', true),
};

const ConfigCardKook = ({ cardCtx, pageCtx }: SettingsCardProps) => {
  const { isReadOnly, isLoading, isSaving, apiData, saveChanges, cardPendingSave } = pageCtx;

  // reducer 管理本地 configs 状态
  const [states, dispatch] = useReducer(
    configsReducer<typeof pageConfigs>,
    null,
    () => getConfigEmptyState(pageConfigs),
  );

  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [jsonEditorErrors, setJsonEditorErrors] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 将 dispatch 适配器用 useCallback 缓存，避免每次渲染产生新的函数引用
  const handleDispatch = useCallback((action: PageConfigReducerAction<any>) => {
    // 直接调用 reducer 的 dispatch（它本身是稳定的）
    dispatch(action as any);
  }, [dispatch]);

  // memoize configs，只有 cardCtx.cardId 或 apiData 发生变化时重新计算
  const configs = useMemo(() => {
    // 注意：这里传入的是稳定的 handleDispatch
    return getConfigAccessors(cardCtx.cardId, pageConfigs, apiData, handleDispatch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardCtx.cardId, apiData, handleDispatch]);

  // isPending 标志
  const isPending = cardPendingSave !== null && cardPendingSave.cardId === cardCtx.cardId;

  // 使用 effect 在相关依赖变更时计算 hasLocalChanges
  // 只取用 states 的必要字段作为依赖，避免不必要的触发
  useEffect(() => {
    // getConfigDiff 应该是纯函数：返回 { hasChanges, localConfigs, ... }
    try {
      const { hasChanges } = getConfigDiff(configs, states, {}, showAdvanced);
      setHasLocalChanges(Boolean(hasChanges));
    } catch (err) {
      // 如果 getConfigDiff 抛异常，不要使组件崩溃，记录并保持现有 hasLocalChanges
      // console.error('getConfigDiff 错误', err);
    }
    // 依赖：configs（memoized），states 的字段，以及 showAdvanced
    // 如果 states 是一个整体不可变的引用（由 reducer 管理），也可以仅依赖 states
    // 但为安全起见，列出常用字段
  }, [
    configs,
    states.enabled,
    states.token,
    states.guildId,
    states.warningsChannel,
    states.statusChannel,
    states.embedJson,
    states.embedConfigJson,
    showAdvanced,
  ]);

  // 验证JSON配置
  const validateJsonConfigs = useCallback(() => {
    const errors: Record<string, string> = {};

    try {
      if (states.embedJson) JSON.parse(states.embedJson);
    } catch (error) {
      errors.embedJson = '无效的JSON格式';
    }

    try {
      if (states.embedConfigJson) JSON.parse(states.embedConfigJson);
    } catch (error) {
      errors.embedConfigJson = '无效的JSON格式';
    }

    setJsonEditorErrors(errors);
    if (Object.keys(errors).length > 0) {
      throw new Error('JSON配置无效');
    }
  }, [states.embedJson, states.embedConfigJson]);

  // 保存更改
  const handleSave = useCallback(async () => {
    try {
      validateJsonConfigs();

      const { localConfigs } = getConfigDiff(configs, states, {}, showAdvanced);
      await saveChanges(cardCtx, localConfigs);
      setHasLocalChanges(false);
      setJsonEditorErrors({});
    } catch (error: any) {
      console.error('保存KOOK Bot配置失败:', error);
      // 可在此显示错误通知
    }
  }, [validateJsonConfigs, configs, states, showAdvanced, saveChanges, cardCtx]);

  // 丢弃更改（撤回到 reducer 管理的 last remote 值）
  const handleDiscard = useCallback(() => {
    Object.values(configs).forEach((config) => {
      // 假设 config.state.discard() 会触发 reducer 更新（是预期的）
      config.state.discard();
    });
    setJsonEditorErrors({});
    // 不需要手动调用 setHasLocalChanges；effect 会在 reducer 更新后重新计算
  }, [configs]);

  // 重置为默认值
  const handleReset = useCallback(() => {
    Object.values(configs).forEach((config) => {
      config.state.default();
    });
    setJsonEditorErrors({});
    // effect 将检测到 changes
  }, [configs]);

  // 格式化 JSON
  const handleBeautifyJson = useCallback(
    (field: 'embedJson' | 'embedConfigJson') => {
      if (states[field]) {
        dispatch({ type: 'SET_CONFIG', configName: field, configValue: attemptBeautifyJsonString(states[field] || '') } as any);
        // effect 会在 states 变化后自动计算 hasLocalChanges
      }
    },
    [states.embedJson, states.embedConfigJson],
  );

  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <CardTitle>KOOK 机器人</CardTitle>
        <CardDescription>配置KOOK机器人的连接和功能</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 主要设置 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Switch
                      id="kook-enabled"
                      disabled={isReadOnly}
                      checked={states.enabled === true}
                      onCheckedChange={(checked) => {
                        dispatch({ configName: 'enabled', configValue: checked } as any);
                        // 不再手动调用 handleConfigChange；effect 会检测变化
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>启用KOOK机器人功能</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Label htmlFor="kook-enabled" className="cursor-pointer">
                启用KOOK机器人
              </Label>
            </div>
            {!apiData && isLoading && <span className="text-sm text-muted-foreground">加载中...</span>}
          </div>
        </div>

        {(states.enabled === true || apiData?.storedConfigs?.kookBot?.enabled) && (
          <div className="space-y-4 pt-2">
            {/* Token */}
            <div className="space-y-2">
              <Label htmlFor="kook-token">机器人 Token</Label>
              <Input
                id="kook-token"
                disabled={isReadOnly}
                placeholder="KOOK Bot Token"
                value={states.token || ''}
                onChange={(e) => {
                  dispatch({ configName: 'token', configValue: e.target.value } as any);
                }}
              />
              <p className="text-xs text-muted-foreground">
                您可以在KOOK开发者中心创建应用程序并获取机器人Token。
              </p>
            </div>

            {/* 服务器 ID */}
            <div className="space-y-2">
              <Label htmlFor="kook-guildId">服务器 ID</Label>
              <Input
                id="kook-guildId"
                disabled={isReadOnly}
                placeholder="KOOK 服务器 ID"
                value={states.guildId || ''}
                onChange={(e) => {
                  dispatch({ configName: 'guildId', configValue: e.target.value } as any);
                }}
              />
              <p className="text-xs text-muted-foreground">这是您要连接的KOOK服务器的ID。</p>
            </div>

            {/* 警告频道 */}
            <div className="space-y-2">
              <Label htmlFor="kook-warningsChannel">警告频道 ID</Label>
              <Input
                id="kook-warningsChannel"
                disabled={isReadOnly}
                placeholder="警告频道 ID (可选)"
                value={states.warningsChannel || ''}
                onChange={(e) => {
                  dispatch({ configName: 'warningsChannel', configValue: e.target.value } as any);
                }}
              />
              <p className="text-xs text-muted-foreground">设置后，txAdmin将在此频道发送警告和系统消息。</p>
            </div>

            {/* 状态频道 */}
            <div className="space-y-2">
              <Label htmlFor="kook-statusChannel">状态频道 ID</Label>
              <Input
                id="kook-statusChannel"
                disabled={isReadOnly}
                placeholder="状态频道 ID (可选)"
                value={states.statusChannel || ''}
                onChange={(e) => {
                  dispatch({ configName: 'statusChannel', configValue: e.target.value } as any);
                }}
              />
              <p className="text-xs text-muted-foreground">设置后，txAdmin将在此频道发送服务器状态消息。</p>
            </div>

            {/* 高级设置 */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="kook-show-advanced">显示高级设置</Label>
                <Switch
                  id="kook-show-advanced"
                  disabled={isReadOnly}
                  checked={showAdvanced}
                  onCheckedChange={(checked) => {
                    setShowAdvanced(checked);
                  }}
                />
              </div>

              {showAdvanced && (
                <Tabs defaultValue="embed-json" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="embed-json">状态嵌入 JSON</TabsTrigger>
                    <TabsTrigger value="embed-config">状态配置 JSON</TabsTrigger>
                  </TabsList>

                  {/* 状态嵌入 JSON */}
                  <TabsContent value="embed-json" className="space-y-2 pt-4">
                    <div className="flex justify-between">
                      <Label htmlFor="kook-embedJson">状态嵌入 JSON</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isReadOnly || !states.embedJson}
                        onClick={() => handleBeautifyJson('embedJson')}
                      >
                        格式化 JSON
                      </Button>
                    </div>
                    <Textarea
                      id="kook-embedJson"
                      disabled={isReadOnly}
                      placeholder="KOOK 状态嵌入 JSON 配置"
                      className={`min-h-[240px] font-mono text-xs ${jsonEditorErrors.embedJson ? 'border-destructive' : ''}`}
                      value={states.embedJson || ''}
                      onChange={(e) => {
                        dispatch({ configName: 'embedJson', configValue: e.target.value } as any);
                      }}
                    />
                    {jsonEditorErrors.embedJson && <p className="text-xs text-destructive">{jsonEditorErrors.embedJson}</p>}
                    <p className="text-xs text-muted-foreground">
                      配置KOOK机器人发送的服务器状态卡片消息格式。使用双花括号 包围的占位符会被自动替换。
                    </p>
                  </TabsContent>

                  {/* 状态配置 JSON */}
                  <TabsContent value="embed-config" className="space-y-2 pt-4">
                    <div className="flex justify-between">
                      <Label htmlFor="kook-embedConfigJson">状态配置 JSON</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isReadOnly || !states.embedConfigJson}
                        onClick={() => handleBeautifyJson('embedConfigJson')}
                      >
                        格式化 JSON
                      </Button>
                    </div>
                    <Textarea
                      id="kook-embedConfigJson"
                      disabled={isReadOnly}
                      placeholder="KOOK 状态配置 JSON"
                      className={`min-h-[240px] font-mono text-xs ${jsonEditorErrors.embedConfigJson ? 'border-destructive' : ''}`}
                      value={states.embedConfigJson || ''}
                      onChange={(e) => {
                        dispatch({ configName: 'embedConfigJson', configValue: e.target.value } as any);
                      }}
                    />
                    {jsonEditorErrors.embedConfigJson && <p className="text-xs text-destructive">{jsonEditorErrors.embedConfigJson}</p>}
                    <p className="text-xs text-muted-foreground">配置服务器状态文本、颜色和按钮。</p>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
        )}

        {/* 信息提示 */}
        {states.enabled === true && (
          <Alert variant="default" className="mt-2">
            <AlertTitle>配置提示</AlertTitle>
            <AlertDescription>
              配置完成后，txAdmin将自动连接到KOOK机器人服务。确保机器人已添加到您的服务器并拥有适当的权限。
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex justify-between border-t px-6 py-4">
        <div className="space-x-2">
          <Button variant="ghost" disabled={isReadOnly || isSaving || !hasLocalChanges || isPending} onClick={handleDiscard}>
            放弃更改
          </Button>
          <Button variant="ghost" disabled={isReadOnly || isSaving || isPending} onClick={handleReset}>
            重置为默认值
          </Button>
        </div>
        <Button disabled={isReadOnly || isSaving || !hasLocalChanges || isPending} onClick={handleSave}>
          {isSaving && isPending ? '保存中...' : '保存更改'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ConfigCardKook;