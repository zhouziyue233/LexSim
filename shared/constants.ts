import type { LLMConfig, ProceedingType, EntityRole } from './types.js'

export const PROCEEDING_TYPE_MAP: Record<string, string> = {
  EVIDENCE_SUBMISSION: '证据提交',
  CROSS_EXAMINATION: '交叉询问',
  ORAL_ARGUMENT: '法庭辩论',
  SETTLEMENT_OFFER: '和解要约',
  JUDICIAL_RULING: '法官裁量',
  WITNESS_TESTIMONY: '证人证词',
  MEDIA_REPORT: '媒体报道',
  SOCIAL_POST: '网络发声',
  LEGISLATIVE_MOTION: '议员质询',
  GOVT_STATEMENT: '政府声明',
  PUBLIC_PROTEST: '公众行动',
  EXPERT_OPINION: '专家意见',
}

export interface LLMProvider {
  id: string
  label: string
  apiBase: string
  models: { label: string; value: string }[]
}

export const LLM_PROVIDERS: LLMProvider[] = [
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    apiBase: 'https://api.openai.com/v1',
    models: [
      { label: 'GPT-4o', value: 'gpt-4o' },
      { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
      { label: 'GPT-4.1', value: 'gpt-4.1' },
      { label: 'GPT-4.1 Mini', value: 'gpt-4.1-mini' },
      { label: 'o3 Mini', value: 'o3-mini' },
    ],
  },
  {
    id: 'claude',
    label: 'Claude',
    apiBase: 'https://api.anthropic.com/v1',
    models: [
      { label: 'Claude Sonnet 4', value: 'claude-sonnet-4-20250514' },
      { label: 'Claude Haiku 3.5', value: 'claude-3-5-haiku-20241022' },
      { label: 'Claude Opus 4', value: 'claude-opus-4-20250514' },
    ],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [
      { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash-preview-04-17' },
      { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro-preview-03-25' },
      { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
    ],
  },
  {
    id: 'grok',
    label: 'Grok',
    apiBase: 'https://api.x.ai/v1',
    models: [
      { label: 'Grok 3', value: 'grok-3' },
      { label: 'Grok 3 Mini', value: 'grok-3-mini' },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    apiBase: 'https://api.deepseek.com/v1',
    models: [
      { label: 'DeepSeek Chat (V3)', value: 'deepseek-chat' },
      { label: 'DeepSeek Reasoner (R1)', value: 'deepseek-reasoner' },
    ],
  },
  {
    id: 'qwen',
    label: 'Qwen',
    apiBase: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      { label: 'Qwen Plus', value: 'qwen-plus' },
      { label: 'Qwen Max', value: 'qwen-max' },
      { label: 'Qwen Turbo', value: 'qwen-turbo' },
      { label: 'Qwen Long', value: 'qwen-long' },
    ],
  },
  {
    id: 'glm',
    label: 'GLM',
    apiBase: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      { label: 'GLM-4 Plus', value: 'glm-4-plus' },
      { label: 'GLM-4 Air', value: 'glm-4-air' },
      { label: 'GLM-4 Flash', value: 'glm-4-flash' },
      { label: 'GLM-4 Long', value: 'glm-4-long' },
    ],
  },
  {
    id: 'kimi',
    label: 'Kimi',
    apiBase: 'https://api.moonshot.cn/v1',
    models: [
      { label: 'Moonshot v1 8K', value: 'moonshot-v1-8k' },
      { label: 'Moonshot v1 32K', value: 'moonshot-v1-32k' },
      { label: 'Moonshot v1 128K', value: 'moonshot-v1-128k' },
    ],
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    apiBase: 'https://api.minimax.io/v1',
    models: [
      { label: 'abab6.5s', value: 'abab6.5s-chat' },
      { label: 'abab6.5', value: 'abab6.5-chat' },
      { label: 'abab5.5', value: 'abab5.5-chat' },
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    apiBase: 'https://openrouter.ai/api/v1',
    models: [
      { label: 'Auto（自动路由）', value: 'openrouter/auto' },
      { label: 'Claude Sonnet 4', value: 'anthropic/claude-sonnet-4' },
      { label: 'GPT-4o', value: 'openai/gpt-4o' },
      { label: 'DeepSeek Chat', value: 'deepseek/deepseek-chat' },
      { label: 'Llama 3.3 70B', value: 'meta-llama/llama-3.3-70b-instruct' },
    ],
  },
]

/** @deprecated Use LLM_PROVIDERS instead */
export const LLM_PRESETS: { label: string; apiBase: string; model: string }[] =
  LLM_PROVIDERS.flatMap(p =>
    p.models.map(m => ({ label: `${p.label} ${m.label}`, apiBase: p.apiBase, model: m.value })),
  )

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  apiKey: '',
  apiBase: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model: 'qwen-plus',
}

export const MIN_SIMULATION_ROUNDS = 10
export const MAX_SIMULATION_ROUNDS = 50
export const DEFAULT_SIMULATION_ROUNDS = 20

/** Maps each EntityRole to its allowed ProceedingTypes */
export const ROLE_ALLOWED_ACTIONS: Record<EntityRole, ProceedingType[]> = {
  PLAINTIFF:          ['EVIDENCE_SUBMISSION', 'ORAL_ARGUMENT', 'SETTLEMENT_OFFER'],
  DEFENDANT:          ['EVIDENCE_SUBMISSION', 'ORAL_ARGUMENT', 'SETTLEMENT_OFFER'],
  PLAINTIFF_LAWYER:   ['EVIDENCE_SUBMISSION', 'CROSS_EXAMINATION', 'ORAL_ARGUMENT', 'SETTLEMENT_OFFER'],
  DEFENDANT_LAWYER:   ['EVIDENCE_SUBMISSION', 'CROSS_EXAMINATION', 'ORAL_ARGUMENT', 'SETTLEMENT_OFFER'],
  JUDGE:              ['JUDICIAL_RULING'],
  WITNESS:            ['WITNESS_TESTIMONY'],
  MEDIA_OUTLET:       ['MEDIA_REPORT'],
  ONLINE_INFLUENCER:  ['SOCIAL_POST'],
  LEGISLATOR:         ['LEGISLATIVE_MOTION'],
  GOVERNMENT_AGENCY:  ['GOVT_STATEMENT'],
  PUBLIC_STAKEHOLDER: ['PUBLIC_PROTEST'],
  ADVOCACY_GROUP:     ['PUBLIC_PROTEST'],
  EXPERT_COMMENTATOR: ['EXPERT_OPINION'],
}

export const IN_COURT_TYPES: Set<ProceedingType> = new Set([
  'EVIDENCE_SUBMISSION', 'CROSS_EXAMINATION', 'ORAL_ARGUMENT',
  'SETTLEMENT_OFFER', 'JUDICIAL_RULING', 'WITNESS_TESTIMONY',
])

// ─── Evidence Category Weights ────────────────────────────────────────────────
// 按证据类型赋予法律效力倍数，体现证据分级制度
export const EVIDENCE_CATEGORY_WEIGHTS: Record<string, number> = {
  DIRECT:       1.0,   // 直接证据：书证、物证、视听资料、电子数据
  EXPERT:       0.85,  // 专家证人/鉴定意见
  WITNESS:      0.65,  // 普通证人证词
  CIRCUMSTANTIAL: 0.5, // 间接证据/情况证据
  HEARSAY:      0.2,   // 传闻证据（中国法中效力极低）
}

// 证据分类标签（供前端展示）
export const EVIDENCE_CATEGORY_LABELS: Record<string, string> = {
  DIRECT:         '直接证据',
  EXPERT:         '专家意见/鉴定',
  WITNESS:        '证人证词',
  CIRCUMSTANTIAL: '间接证据',
  HEARSAY:        '传闻证据',
}

// ─── Case Type → Statute Mapping（法条映射表）────────────────────────────────
// 按案件类型提供常见法条，供 JudgeAgent 使用，防止 LLM 幻觉引用
export interface StatuteRef {
  code: string      // 如 "《民法典》第577条"
  content: string   // 条文摘要
}

export const CASE_TYPE_STATUTES: Record<string, StatuteRef[]> = {
  劳动争议: [
    { code: '《劳动合同法》第87条', content: '用人单位违反本法规定解除或终止劳动合同，应当依照第47条规定的经济补偿标准的二倍向劳动者支付赔偿金。' },
    { code: '《劳动合同法》第47条', content: '经济补偿按劳动者在本单位工作的年限，每满一年支付一个月工资的标准向劳动者支付。' },
    { code: '《劳动争议调解仲裁法》第27条', content: '劳动争议申请仲裁的时效期间为一年，从当事人知道或应当知道其权利被侵害之日起计算。' },
    { code: '《劳动合同法》第39-41条', content: '用人单位单方解除劳动合同须符合法定情形，过失性辞退须员工存在严重违规，非过失性辞退须提前30日书面通知或额外支付一个月工资。' },
  ],
  合同纠纷: [
    { code: '《民法典》第577条', content: '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。' },
    { code: '《民法典》第563条', content: '当事人可以约定一方迟延履行或者其他违约情形时，对方有权解除合同。' },
    { code: '《民法典》第584条', content: '损失赔偿额应相当于因违约所造成的损失，包括合同履行后可以获得的利益，不得超过违约方订立合同时预见到或应当预见到的损失。' },
  ],
  侵权责任: [
    { code: '《民法典》第1165条', content: '行为人因过错侵害他人民事权益造成损害的，应当承担侵权责任；推定行为人有过错，行为人不能证明自己没有过错则承担侵权责任。' },
    { code: '《民法典》第1179条', content: '侵害他人造成人身损害的，应赔偿医疗费、护理费、交通费、营养费、住院伙食补助费等为治疗和康复支出的合理费用，以及因误工减少的收入。' },
    { code: '《民法典》第1182条', content: '侵害他人人身权益造成财产损失的，按照被侵权人因此受到的损失或者侵权人因此获得的利益赔偿；两者难以确定的，参照类似知识产权许可使用费给予赔偿。' },
  ],
  知识产权: [
    { code: '《著作权法》第52条', content: '侵犯著作权或者与著作权有关的权利的，侵权人应当按照权利人的实际损失或侵权人的违法所得给予赔偿；难以计算的，由法院根据侵权情节在500元至500万元以内酌情确定。' },
    { code: '《专利法》第71条', content: '侵犯专利权的赔偿数额按照权利人因被侵权所受到的实际损失或者侵权人因侵权所获得的利益确定；难以确定的，参照专利许可使用费的倍数合理确定。' },
    { code: '《商标法》第63条', content: '侵犯商标专用权的赔偿数额，按权利人因侵权受到的实际损失确定；实际损失难以确定的，按侵权人因侵权获得的利益确定。' },
  ],
  房产纠纷: [
    { code: '《民法典》第215条', content: '当事人之间订立有关设立、变更、转让和消灭不动产物权的合同，除法律另有规定或者当事人另有约定外，自合同成立时生效；未办理物权登记的，不影响合同效力。' },
    { code: '《民法典》第209条', content: '不动产物权的设立、变更、转让和消灭，经依法登记，发生效力；未经登记，不发生效力，但是法律另有规定的除外。' },
  ],
  婚姻家庭: [
    { code: '《民法典》第1087条', content: '离婚时，夫妻的共同财产由双方协议处理；协议不成的，由人民法院根据财产的具体情况，按照照顾子女、女方和无过错方权益的原则判决。' },
    { code: '《民法典》第1084条', content: '父母与子女间的关系，不因父母离婚而消除。离婚后，子女无论由父或者母直接抚养，仍是父母双方的子女。' },
  ],
  刑事案件: [
    { code: '《刑事诉讼法》第55条', content: '对一切案件的判处都要重证据，重调查研究，不轻信口供。只有被告人供述，没有其他证据的，不能认定被告人有罪和处以刑罚。' },
    { code: '《刑事诉讼法》第12条', content: '未经人民法院依法判决，对任何人都不得确定有罪。' },
    { code: '《刑法》第13条', content: '危害社会的行为，依照法律应当受刑罚处罚的，都是犯罪，但情节显著轻微危害不大的，不认为是犯罪。' },
  ],
  行政诉讼: [
    { code: '《行政诉讼法》第34条', content: '被告对作出的行政行为负有举证责任，应当提供作出该行政行为的证据和所依据的规范性文件。' },
    { code: '《行政诉讼法》第70条', content: '行政行为有主要证据不足、适用法律法规错误、违反法定程序、超越职权、滥用职权、明显不当情形之一的，人民法院判决撤销或者部分撤销。' },
  ],
  公司股权: [
    { code: '《公司法》第74条', content: '有下列情形之一的，对股东会该项决议投反对票的股东，可以请求公司按照合理的价格收购其股权。' },
    { code: '《公司法》第20条', content: '公司股东应当遵守法律、行政法规和公司章程，依法行使股东权利，不得滥用股东权利损害公司或者其他股东的利益。' },
  ],
}

/**
 * 根据案件描述关键词，匹配最相关的法条集合。
 * 返回不超过 maxStatutes 条法条引用字符串，用于注入 JudgeAgent 上下文。
 */
export function getRelevantStatutes(caseInput: string, maxStatutes = 5): StatuteRef[] {
  const text = caseInput.toLowerCase()
  const scores: Array<{ key: string; score: number }> = []

  const keywords: Record<string, string[]> = {
    劳动争议:  ['劳动', '解雇', '辞退', '工资', '劳动合同', '裁员', '工伤', '仲裁', '社保'],
    合同纠纷:  ['合同', '违约', '履行', '交货', '付款', '解除合同', '合同纠纷'],
    侵权责任:  ['侵权', '损害赔偿', '人身伤害', '交通事故', '医疗事故', '过错', '赔偿'],
    知识产权:  ['著作权', '专利', '商标', '版权', '知识产权', '侵权', '许可'],
    房产纠纷:  ['房产', '房屋', '买卖', '租赁', '土地', '不动产', '产权', '物权'],
    婚姻家庭:  ['离婚', '抚养', '赡养', '财产分割', '婚姻', '子女', '继承'],
    刑事案件:  ['刑事', '犯罪', '诈骗', '盗窃', '故意伤害', '检察院', '公诉', '被告人'],
    行政诉讼:  ['行政', '政府', '行政许可', '处罚', '行政诉讼', '撤销', '行政行为'],
    公司股权:  ['公司', '股权', '股东', '股份', '董事', '章程', '合并', '分立'],
  }

  for (const [key, kws] of Object.entries(keywords)) {
    const score = kws.filter(kw => text.includes(kw)).length
    if (score > 0) scores.push({ key, score })
  }

  scores.sort((a, b) => b.score - a.score)
  const topKeys = scores.slice(0, 2).map(s => s.key)

  const result: StatuteRef[] = []
  for (const key of topKeys) {
    const statutes = CASE_TYPE_STATUTES[key] ?? []
    result.push(...statutes)
    if (result.length >= maxStatutes) break
  }
  return result.slice(0, maxStatutes)
}
