# dsh-codex-compat-canary

检测 DeepSeek Harness 无法安全解释的 Codex App Server 协议漂移。

第一次真实运行已经发现一个具体兼容性问题：DeepSeek Harness `0.1.1-rc.2` 固定使用 Codex `0.147.0`，而 Codex `0.149.1` 新增了 `misalignmentPolicyViolation`；当前 Harness 适配器会把它降级显示为 `unknown`。完整基线、失败、最小修复与重复工作核查见[可复现实验报告](docs/EXPERIMENT_2026-08-25.md)。

[English](README.md)

## 为什么需要它

DeepSeek Harness 的 Codex 子代理包会固定一个 `@openai/codex` 版本。更新依赖后，启动、握手、审批、取消和进程清理可能全部正常，但新增加的协议值仍可能丢失。普通冒烟测试因此可能通过，而用户看到的失败解释已经退化。

这个 Canary 不执行 Harness 源码，只读取官方适配器；随后通过官方 Codex CLI 生成固定版本和目标版本的 JSON Schema，检查适配器实际消费的协议值。它选择外部 CLI 形态，是因为当集成本身发生故障时，诊断工具仍应能够运行。

## 快速开始

```sh
npx dsh-codex-compat-canary@latest
```

默认比较 DeepSeek Harness 官方 `master` 分支固定的 Codex 版本与 npm 上最新的 `@openai/codex`。当已实现的破坏性检查失败时，进程返回代码 `1`。

检查本地源码或固定目标版本：

```sh
npx dsh-codex-compat-canary@latest \
  --dsh-source /path/to/deepseek-harness \
  --codex-version 0.149.1 \
  --json canary-report.json
```

`--dsh-ref <分支|标签|提交>` 可固定官方源码版本；`--format json` 会把 JSON 输出到标准输出；`--fail-on review` 可让需要人工复核的漂移也令 CI 失败。

## v0.1 检查范围

- 对照 Codex `CodexErrorInfo` 的字符串与对象 variant，以及 Harness 适配器实际处理的 case。
- 对照 Codex 新增的服务器请求方法，以及适配器的无人值守请求处理器。
- 汇总新增、删除和变化的生成 Schema 文件，供人工复核。
- 在机器可读报告中记录 Harness 源码提交、包版本、Codex 固定版本和目标版本。

Canary 不宣称证明全部行为兼容。它不调用模型、不读取 Codex 或 DeepSeek 凭证、不修改 Harness、不安装用户 Profile 插件，也不会自动把报告上传到外部服务。

## 返回代码

| 代码 | 含义 |
|---|---|
| `0` | 没有发现达到 `--fail-on` 阈值的问题。 |
| `1` | 发现达到阈值的兼容性问题。 |
| `2` | 因网络、源码、Schema 或参数错误而未完成检查。 |

## 自动巡检

仓库的每周工作流会用当前官方 Harness `master` 和最新 Codex 包运行同一套逻辑，保存 JSON 报告，并在兼容性问题持续存在时创建或更新同一个仓库 Issue；恢复兼容后会关闭该 Issue。

## 安全与隐私

报告只包含版本、提交、Schema 与协议值元数据，不包含提示词、会话内容、凭证或本地源码绝对路径。生成 Schema 会执行所选的官方 `@openai/codex` npm 包；在敏感环境中请固定精确版本并遵守你的软件供应链策略。详见 [SECURITY.md](SECURITY.md)。

## 产品边界

它不是新的 Codex 桥、替代界面、自动更新器、通用 Harness Doctor 或生产补丁器。DeepSeek Harness 已经提供 Codex 子代理和 Codex Hooks 桥。只有真实协议漂移证明现有窄检查无法覆盖时，才会增加新的检查。

## 许可证

MIT
