import { useEffect, useRef, useState } from 'react'
import { Play, RotateCcw, Upload, FileText } from 'lucide-react'
import {
  DEFAULT_SIMULATION_ROUNDS,
  MAX_SIMULATION_ROUNDS,
  MIN_SIMULATION_ROUNDS,
} from '@shared/constants'
import { useT } from '../../hooks/useT'
import { useLanguage } from '../../contexts/LanguageContext'

const EXAMPLE_PROJECT_NAME = '87名专才子女挑战香港教育局本地学生入学资格政策'

const EXAMPLE_PROJECT_NAME_EN = 'SFFA vs Harvard'

const EXAMPLE_CASE_EN = `# Students for Fair Admissions v. Harvard

## 1. Litigation Participants

### **The Parties**

- **Plaintiff: Students for Fair Admissions (SFFA)**
  - A non-profit membership organization led by legal activist Edward Blum. It represents a group of students and parents who believe that racial preferences in admissions are unconstitutional.
- **Defendant: President and Fellows of Harvard College (Harvard Corporation)**
  - As a private university receiving federal financial assistance, Harvard is bound by Title VI of the Civil Rights Act of 1964.

### **Lead Counsel**

| **Side**                | **Key Attorney**   | **Background**                                               |
| ----------------------- | ------------------ | ------------------------------------------------------------ |
| **SFFA (Plaintiff)**    | **Cameron Norris** | From the firm Consovoy McCarthy, which specializes in challenging race-based government and institutional policies. |
| **Harvard (Defendant)** | **Seth Waxman**    | A prominent former U.S. Solicitor General known for his extensive experience arguing before the Supreme Court. |

### **The Supreme Court Justices (8 Participating)**

Justice **Ketanji Brown Jackson** recused herself from the Harvard case because she had previously served on Harvard's Board of Overseers.

- **Conservative Block:** Chief Justice John Roberts, Clarence Thomas, Samuel Alito, Neil Gorsuch, Brett Kavanaugh, Amy Coney Barrett.
- **Liberal Block:** Sonia Sotomayor, Elena Kagan.

------

## 2. Case Factual Background

The case originated in 2014 when SFFA sued Harvard, alleging that its **"Holistic Admissions"** process was a veneer for racial discrimination. The factual core of the case relied on internal admissions data:

- **The Scoring System:** Harvard rates applicants on Academic, Extracurricular, Athletic, Personal, and Overall categories.
- **The "Personal Rating" Controversy:** Data revealed that Asian American applicants consistently scored higher than any other racial group on objective measures (Academic and Extracurricular). However, they received the lowest scores on the "Personal Rating"—a subjective measure evaluating traits like "likability," "integrity," and "courage."
- **Statistical Stability:** SFFA argued that the percentage of each race in the admitted class remained remarkably stable year over year, suggesting the existence of an illegal "racial quota" or "racial balancing."

------

## 3. Legal Issues (Questions Presented)

The court focused on three primary legal questions:

1. **Compliance with Title VI:** Did Harvard's admissions process violate the Civil Rights Act by discriminating against Asian American applicants?
2. **Strict Scrutiny:** Does Harvard's use of race serve a "compelling interest" (the educational benefits of diversity) that is "narrowly tailored"?
3. **Precedent Review:** Should the Court overrule *Grutter v. Bollinger* (2003), which previously allowed the limited use of race in admissions?

------

## 4. Core Arguments of the Parties

### **SFFA (Plaintiff's Position)**

- **The Colorblind Constitution:** Argued that the 14th Amendment and the Civil Rights Act require individuals to be treated as individuals, not as members of a racial group.
- **Race as a "Negative":** Contended that in a zero-sum admissions environment, giving a "plus" to certain races (Black and Hispanic) inherently acts as a "minus" for others (Asian Americans).
- **Race-Neutral Alternatives:** Claimed Harvard could achieve diversity through other means, such as focusing on socioeconomic status or ending preferences for the children of wealthy donors ("Legacy Admissions").

### **Harvard (Defendant's Position)**

- **The Diversity Mandate:** Argued that a diverse student body is essential for fostering a better learning environment and preparing leaders for a global society.
- **Race as a "Plus Factor":** Maintained that race is never a "deciding factor" on its own but is used as one of many factors in a holistic review to understand the whole person.
- **Educational Autonomy:** Asserted that universities have a First Amendment right to decide their own academic criteria and composition of their student body.

------

## 5. Societal Focus and Public Interest

The case became a flashpoint for several major social debates:

- **The Definition of Merit:** The case forced a national conversation on whether "merit" should be defined strictly by test scores and grades or by a broader set of life experiences.
- **Asian American Representation:** The lawsuit highlighted a divide within the Asian American community. Some felt they were victims of a "bamboo ceiling" in education, while others feared that ending affirmative action would harm broader civil rights progress.
- **End of "Legacy" Admissions:** The case brought intense scrutiny to "Legacy" and "Donor" preferences, with many arguing that if race-based admissions were to end, "wealth-based" preferences for the elite should also be abolished.
- **Future of Identity:** The public closely watched how the ruling would affect corporate DEI (Diversity, Equity, and Inclusion) programs and the future of racial identity in the American workplace.`

const EXAMPLE_CASE = `### 一、案件基本资料

| 项目         | 内容                                                         |
| ------------ | ------------------------------------------------------------ |
| 案件编号     | HCAL 2434/2025；[2025] HKCFI 6156                            |
| 法院         | 香港高等法院原讼法庭（宪法及行政诉讼案件名单）               |
| 申请人       | 87名未成年人，由父母以"至亲"（next friend）身份代为提出；首三名为陈依依、郑敬豪、吴亦飞 |
| 答辩人       | 教育局局长                                                   |
| 申请人律师行 | Dentons（邓顿）；资深大律师白天赐（Tim Parker）              |
| 答辩人代表   | 律政司；马嘉骏大律师                                         |
| 法官         | 高浩文法官（Mr Justice Coleman）                             |

------

### 二、政策背景与"考试移民"争议

在旧有政策下，受养人子女若在首次获签发签证时未满18岁，便可自动享有"本地学生"资格，从而有权申请香港资助大学学额。这种便利被部分升学中介机构宣传为"考试移民"或"弯道超车"的途径——子女无需在港长期就读中学，只需在内地接受DSE培训，即可以"本地生"身份报考并享受远低于非本地生的资助学费，直接与香港本地中学生竞争大学学额。

近日已有多位法律人士指出，《基本法》列明香港居民在法律面前一律平等，因此要求同属香港居民的受养人须居港一定年期才能以"本地学生"身份入学，可能因与法律原则矛盾而招致司法覆核。

政府的应对措施是：设立两个学费类别，并修订有关申请资格准则。受养人须居港满两年才能申请政府资助专上课程学额，有关修订适用于2027/28及以后学年。

------

### 三、政策具体内容及财务影响

香港专上教育课程的收费就本地学生及非本地学生各有不同，而政府资助的学位名额仅提供给本地学生，意味着非本地学生在就读4年制本科课程时，会比本地学生多花费约80万港元。

就资助学费水平，2025/26学年每名学生每学年学费为44,500港元，将在2026/27及2027/28学年以平均每年5.5%的涨幅分别上调至47,000港元及49,500港元。而非本地学生学费约为资助学费的4倍，港大2025/26学年非STEM专业学费约19.8万港元。

------

### 四、司法程序时序

**第一阶段——书面许可（2025年12月8日）**

高浩文法官在书面审查基础上批准许可（leave granted on the papers），认为案件具有足够表面争议值得进入实质审理，同时指示双方就实质聆讯采用"紧凑时间表和尽早聆讯"（"a tight timetable and an early hearing are preferable"）。

**第二阶段——实质聆讯（2026年4月2日）**

案件于2026年4月2日在高等法院进行实质聆讯。法官高浩文听毕双方陈词后，宣布将于本月内颁下裁决。

**第三阶段——待决判决**

截至本文撰写（2026年4月9日），判决尚未颁布，预计于**2026年4月内**发布。

------

### 五、双方核心论点

**申请方：**

申请方提出，在2025年7月前，首次获得家属签证且年龄小于18岁的申请人能被视为本地学生，无需满足任何居住要求，但政府其后更改政策，要求计划在2027/28学年入学的申请人须在港居住最少满一年。申请人均就读A-Level及AP课程等，会于2025/26及2026/27学年在香港以外的中学就读最后两年，及后计划于2027/28学年入读香港的大学。

政策公布时已非常接近2025/26新学年开学季，申请人已在内地学校注册并预计数周后开学；部分A-Level及AP课程已于8月开课，不少香港中学亦没有空缺学额，转校申请期限亦已过，且在考公开试前一年突然转至新城市新学校，将令学生处于适应劣势。

**答辩方：**

答辩方指，政府为本地学生提供大学学费资助计划，新政策要求本地学生须在本港居住满最少一年，根本对真正的本地学生不会造成任何影响。而政策针对的不只是申请方，不论来自什么地区及就读什么课程的人均受限于此政策，牵涉的人数众多，大部分人都没有对政策不满，惟只有申请方作出投诉，故不应因小众而改变大制度。

------

### 六、核心法律争点

本案主要涉及三项行政法原则：

1. **合理期望**（Legitimate Expectation）——政府通过人才引进计划吸引家长来港，其后突然收紧子女受惠资格，是否损害申请人基于政府政策所形成的合理信赖；
2. **程序公正**（Procedural Fairness）——政策公布距实施时间极短，申请人是否获得合理调整期；
3. **比例原则**（Proportionality）——过渡安排的一年居港要求，是否与所追求的政策目标相称。`

interface Props {
  initialCaseInput?: string
  initialRoundCount?: number
  onStart: (caseInput: string, roundCount: number, fileContent?: string, fileName?: string, projectName?: string) => void
  onReset: () => void
  isRunning: boolean
  hasResult: boolean
  autoLoadExample?: boolean
  onExampleLoaded?: () => void
}

export default function CaseInputForm({
  initialCaseInput = '',
  initialRoundCount = DEFAULT_SIMULATION_ROUNDS,
  onStart,
  onReset,
  isRunning,
  hasResult,
  autoLoadExample,
  onExampleLoaded,
}: Props) {
  const T = useT()
  const { lang } = useLanguage()
  const [projectName, setProjectName] = useState('')
  const [input, setInput] = useState('')
  const [roundCount, setRoundCount] = useState(String(DEFAULT_SIMULATION_ROUNDS))
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileContent, setFileContent] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const parsedRounds = Number(roundCount)
  const isRoundCountValid = Number.isInteger(parsedRounds)
    && parsedRounds >= MIN_SIMULATION_ROUNDS
    && parsedRounds <= MAX_SIMULATION_ROUNDS
  const hasFile = fileContent.length > 0
  const hasTextInput = input.trim().length >= 20
  const hasProjectName = projectName.trim().length > 0
  const canSubmit = hasProjectName && (hasFile || hasTextInput) && isRoundCountValid && !isRunning

  useEffect(() => {
    setInput(initialCaseInput)
  }, [initialCaseInput])

  useEffect(() => {
    if (!autoLoadExample) return
    const name = lang === 'en' ? EXAMPLE_PROJECT_NAME_EN : EXAMPLE_PROJECT_NAME
    const content = lang === 'en' ? EXAMPLE_CASE_EN : EXAMPLE_CASE
    setProjectName(name)
    setInput(content)
    setRoundCount(String(DEFAULT_SIMULATION_ROUNDS))
    setFileName('')
    setFileContent('')
    setFileError('')
    onExampleLoaded?.()
  }, [autoLoadExample, lang, onExampleLoaded])

  useEffect(() => {
    setRoundCount(String(initialRoundCount))
  }, [initialRoundCount])

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isRunning) setSubmitting(false)
  }, [isRunning])

  const handleSubmit = () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    onStart(
      input.trim(),
      parsedRounds,
      hasFile ? fileContent : undefined,
      hasFile ? fileName : undefined,
      projectName.trim() || undefined,
    )
  }

  const loadExample = () => {
    const name = lang === 'en' ? EXAMPLE_PROJECT_NAME_EN : EXAMPLE_PROJECT_NAME
    const content = lang === 'en' ? EXAMPLE_CASE_EN : EXAMPLE_CASE
    setProjectName(name)
    setInput(content)
    setRoundCount(String(DEFAULT_SIMULATION_ROUNDS))
    setFileName('')
    setFileContent('')
    setFileError('')
  }

  const handleFile = async (file: File) => {
    setFileError('')
    setFileLoading(true)
    setFileName(file.name)
    try {
      let text = ''
      const ext = file.name.split('.').pop()?.toLowerCase()

      if (ext === 'md' || ext === 'txt') {
        text = await file.text()
      } else if (ext === 'docx') {
        const mammoth = await import('mammoth')
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        text = result.value
      } else if (ext === 'pdf') {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString()
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const pages: string[] = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          pages.push(
            content.items
              .map((item) => ('str' in item ? item.str : ''))
              .join(' ')
          )
        }
        text = pages.join('\n')
      } else {
        setFileError(T('form.unsupportedFile'))
        setFileLoading(false)
        return
      }

      setFileContent(text.slice(0, 50000))
    } catch {
      setFileError(T('form.parseError'))
    } finally {
      setFileLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="card-surface p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          {lang === 'zh' && <p className="text-xs font-semibold text-[#6B8AAD] mb-1 tracking-wider">{T('form.sectionLabel')}</p>}
          <h2 className="text-lg font-semibold text-[#1E293B]">{T('form.sectionTitle')}</h2>
        </div>
        <button
          onClick={loadExample}
          disabled={isRunning}
          className="text-xs text-[#1E4A82] hover:text-[#374D6B] font-medium transition-colors disabled:opacity-40"
        >
          {T('form.loadExample')}
        </button>
      </div>

      {/* Project name */}
      <div className="mb-4">
        <label className="text-sm font-medium text-[#374D6B] block mb-2">{T('form.projectName')}</label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          disabled={isRunning}
          placeholder={T('form.projectPlaceholder')}
          className="w-full bg-white border border-[#D5E0EF] rounded-lg px-3 py-2.5 text-sm text-[#0F1E35] placeholder-[#A8BDD8] focus:outline-none focus:border-ink transition-colors disabled:opacity-50"
          maxLength={100}
        />
      </div>

      {/* File upload area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="mb-3 border border-dashed border-[#D5E0EF] rounded-lg px-4 py-3 flex items-center gap-3 bg-[#F4F7FB] hover:bg-[#EDF2F9] transition-colors cursor-pointer"
        onClick={() => !isRunning && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.md,.txt"
          className="hidden"
          onChange={handleFileChange}
          disabled={isRunning}
        />
        {fileLoading ? (
          <span className="w-4 h-4 border-2 border-[#1E4A82]/30 border-t-[#1E4A82] rounded-full animate-spin shrink-0" />
        ) : (
          <Upload size={15} className="text-[#6B8AAD] shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          {fileName ? (
            <div className="flex items-center gap-1.5">
              <FileText size={13} className="text-[#1E4A82] shrink-0" />
              <span className="text-sm text-[#1E4A82] truncate">{fileName}</span>
              {hasFile && (
                <span className="text-xs text-[#6B8AAD] shrink-0">
                  · {T('form.uploadChars', { n: Math.round(fileContent.length / 1000) })}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-[#6B8AAD]">
              {T('form.uploadHint')} <span className="text-[#A8BDD8]">{T('form.uploadTypes')}</span>
            </span>
          )}
        </div>
        {fileName && !fileLoading && (
          <button
            onClick={(e) => { e.stopPropagation(); setFileName(''); setFileContent(''); setFileError('') }}
            className="text-[#6B8AAD] hover:text-[#1E4A82] text-xs shrink-0"
          >
            {T('form.clearFile')}
          </button>
        )}
      </div>
      {fileError && <p className="text-xs text-red-500 mb-2">{fileError}</p>}

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={isRunning}
        placeholder={hasFile ? T('form.textPlaceholderWithFile') : T('form.textPlaceholder')}
        className="w-full h-48 bg-white border border-[#D5E0EF] rounded-lg p-4 text-sm text-[#0F1E35] placeholder-[#6B8AAD] resize-none focus:outline-none focus:border-ink transition-colors font-mono disabled:opacity-50"
        maxLength={10000}
      />

      <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
        <div>
          <label className="label-micro text-[#64748B] block mb-2">{T('form.rounds')}</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={MIN_SIMULATION_ROUNDS}
              max={MAX_SIMULATION_ROUNDS}
              step={1}
              value={roundCount}
              onChange={(e) => setRoundCount(e.target.value)}
              disabled={isRunning}
              className="w-32 bg-white border border-[#D5E0EF] rounded-lg px-3 py-2.5 text-sm text-[#0F1E35] focus:outline-none focus:border-ink transition-colors disabled:opacity-50"
            />
            <p className="text-xs text-[#475569]">
              {T('form.roundsHint', { min: MIN_SIMULATION_ROUNDS, max: MAX_SIMULATION_ROUNDS, default: DEFAULT_SIMULATION_ROUNDS })}
            </p>
          </div>
          {!isRoundCountValid && (
            <p className="text-xs text-red-400 mt-2">
              {T('form.roundsError', { min: MIN_SIMULATION_ROUNDS, max: MAX_SIMULATION_ROUNDS })}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          {hasResult && (
            <button onClick={onReset} className="btn-outline text-sm py-2 px-4 flex items-center gap-2">
              <RotateCcw size={14} />
              {T('form.reset')}
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="btn-primary text-sm py-2 px-5 flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {T('form.running')}
              </>
            ) : submitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {T('form.starting')}
              </>
            ) : (
              <>
                <Play size={14} />
                {T('form.start')}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-[#475569]">{T('form.charCount', { count: input.length })}</span>
      </div>
    </div>
  )
}
