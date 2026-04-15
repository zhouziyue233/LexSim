# **LexSim — 法律案件预测引擎**

<div align="center">
<img src="./public/biglogo.svg" width="500"/>
</div>

<p align="center"><em>法律不过是对法院将要做什么的预测 — 霍姆斯大法官</em></p>

<p align="center">
  <a href="./README.md">中文</a> | <a href="./README-EN.md">English</a>
</p>

**LexSim** 是一个面向法律场景的多智能体模拟与预测工具。不同于传统“问答式” legal AI，它把案件中的诉讼主体和社会影响方（政府、议员、媒体、博主等）实例化为 LLM Agent，拥有独立的人格、立场和行为策略，在多轮博弈中自主决策。它可以根据各主体动态的博弈过程，通过算法实时计算出原被告双方的胜诉概率，以及法庭外的社会影响指数，最终生成一份综合预测报告，预测案件走向、判决结果、裁判说理，并提供诉讼策略建议和社会影响评估。

<p align="center"><em>输入案件背景 → 识别相关主体 → 构建关系网络 → 多 Agent 并行博弈模拟 → 生成综合预测报告</em></p>

---

## 赞助商

<p align="center">
  <img src="./public/lawmotion-ai.svg" width="300" />
</p>

<p align="center">
  <a href="https://lawmotion.ai/">律動智能</a>
</p>

---

## 核心特性

项目灵感借鉴了 [MiroFish](https://github.com/666ghj/MiroFish)，在此基础上针对法律场景进行了深度重构，强化了工作流的专业性与推理深度。

项目的理论基础源于**法律现实主义（Legal Realism）**和法社会学中的**嵌入式法庭（Embedded Court）**概念，强调从社会现实结构中理解司法决策 —— 法律判决从来不只发生在法庭内部，它深嵌于社会关系、舆论压力与政治博弈之中。

- **不止是法庭，而是一整个社会场域**：除了原告、被告、法官，LexSim 还会自动识别并引入与案件相关的政府机构、立法机关、媒体机构、网络博主等社会影响方。他们在场外发声、施压、博弈，共同塑造案件走向——这正是真实案件的运作方式。
- **每个角色都有自己的立场与性格**：系统为每一方参与者生成独立的人格、利益诉求和行动策略。他们不是执行预设脚本的程序，而是根据局势变化自主判断、主动出击，就像真实的人一样。
- **看得见的关系网络**：案件中所有主体之间的关联——支持、对立、施压、合作——以可交互的可视化图谱呈现，一眼看清谁是关键节点、力量如何分布。
- **模拟真实庭审节奏**：博弈过程按照「开庭陈述 → 证据交锋 → 辩论对抗 → 最终结辩」四个阶段自动推进，不同阶段各方能采取的行动不同，还原真实庭审的节奏感。
- **灵活控制模拟深度**：可设定 10 到 50 轮博弈（默认 20 轮），模拟从简单纠纷到旷日持久的重大案件。
- **深度分析，而非简单打分**：预测报告不只给出一个胜诉概率数字。系统会逐步拆解关键证据、识别转折点、评估舆论走向与潜在风险，最终给出有据可查的综合判断和诉讼策略建议。
- **实时观看博弈过程**：模拟运行时，每个角色的行动、对话与决策会像直播一样滚动呈现，让你清晰看到局势是如何一步步演变的。

---

## 快速开始

### 第一步：安装 Node.js（若已安装，可跳过）

打开终端（Mac 搜索「终端」，Windows 搜索「PowerShell」），根据系统粘贴对应命令：

**macOS / Linux**
```bash
# 安装 nvm（Node 版本管理器）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 重新加载终端配置，使 nvm 生效
source ~/.bashrc 2>/dev/null || source ~/.zshrc 2>/dev/null

# 安装 Node.js LTS 版本
nvm install --lts
```

**Windows**（PowerShell 中运行）
```powershell
# 用 winget 安装 Node.js LTS（Windows 10/11 自带 winget）
winget install OpenJS.NodeJS.LTS
```

安装完成后运行以下命令验证：

```bash
node -v   # 应显示 v20.x.x 或更高版本
```

---

### 第二步：下载并安装项目

在终端中依次执行以下命令：

```bash
# 下载项目
git clone https://github.com/zhouziyue233/LexSim.git
cd LexSim

# 安装依赖（需要等待约 1 分钟，看到"found 0 vulnerabilities"即成功）
npm install
npm --prefix server install
```

---

### 第三步：启动

```bash
npm run dev
```

看到如下输出即表示启动成功：

```
[client] ➜  Local:   http://localhost:5173/
[server] Server running on port 3001
```

用浏览器打开 **http://localhost:5173** 即可使用。

> **配置 AI 模型**：首次使用前，点击预测引擎页面右上角「**模型配置**」，填入你的模型厂商 API Key 即可。支持阿里云通义千问、OpenAI、DeepSeek、Kimi、GLM、Claude、Gemini 等主流模型。

### 👍 示范案例

首次使用，建议先在首页点击 `示范项目`，即可跳转到示范案例页面，先行感受预测引擎的完整输出。

---

## 模拟流程

```
          ┌───────────────────────────────┐
          │  Stage 0 · 案件输入            │
          │  文本 / PDF / Word 上传        │
          │  LLM 生成结构化 caseSummary    │
          └──────────────┬────────────────┘
                         ▼
          ┌───────────────────────────────┐
          │  Stage 1 · 主体识别             │
          │  识别法庭主体 + 社会影响方        │
          │  每个实体生成人格 / 利益 / 策略   │
          └──────────────┬────────────────┘
                         ▼
          ┌───────────────────────────────┐
          │  Stage 2 · 关系网络             │
          │  抽取实体间关系类型与强度          │
          │  D3 力导向图可视化               │
          └──────────────┬────────────────┘
                         ▼
          ┌───────────────────────────────┐
          │  Stage 3 · 多 Agent 博弈       │
          │  GameMaster 协调 N 轮          │
          │  ┌─────────────────────────┐  │
          │  │ per round:              │  │
          │  │  1. 选择活跃 Agent      │  │
          │  │  2. 阶段机切换          │  │
          │  │  3. Promise.all 并行决策│  │
          │  │  4. 行动评分 & 解析     │  │
          │  │  5. 概率偏移 & 关系更新 │  │
          │  │  6. SSE 推送事件        │  │
          │  └─────────────────────────┘  │
          └──────────────┬────────────────┘
                         ▼
          ┌───────────────────────────────┐
          │  Stage 4 · ReACT 预测报告      │
          │  Thought → Tool → Observation  │
          │  5 个分析工具交替调用          │
          │  输出胜诉概率 / 证据 / 风险    │
          └───────────────────────────────┘
```

---

*注：本项目为研究目的的模拟工具，输出结果不构成法律意见。LLM 推理存在不确定性，实际案件请咨询专业律师。*

## 📈 项目统计

 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=zhouziyue233/LexSim&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=zhouziyue233/LexSim&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=zhouziyue233/LexSim&type=date&legend=top-left" />
 </picture>
