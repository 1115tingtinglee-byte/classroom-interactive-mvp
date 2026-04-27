import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type Team = { id: number; name: string; score: number }
type QuestionType = 'single' | 'multiple' | 'boolean'
type Question = {
  id: number
  type: QuestionType
  title: string
  options: string[]
  answer: number[]
  explanation: string
}

const starterNames = ['王小明', '李小華', '陳怡君', '第 1 組', '第 2 組', '第 3 組']

const starterQuestions: Question[] = [
  {
    id: 1,
    type: 'single',
    title: '哪一個工具最適合用來隨機點名？',
    options: ['記分板', '抽籤機', '計時器', '成績匯出'],
    answer: [1],
    explanation: '抽籤機可匯入名單並隨機抽選學生或組別。',
  },
  {
    id: 2,
    type: 'multiple',
    title: '小組競賽記分板應該支援哪些功能？',
    options: ['快速加分', '快速扣分', '即時排序', '離線列印考卷'],
    answer: [0, 1, 2],
    explanation: 'MVP 聚焦快速加減分、即時排序與領先組別顯示。',
  },
  {
    id: 3,
    type: 'boolean',
    title: '倒數計時器結束時應該提供視覺或聲響提示。',
    options: ['對', '錯'],
    answer: [0],
    explanation: '時間到需要明確提醒，避免報告或活動超時。',
  },
]

function arraysEqual(a: number[], b: number[]) {
  return a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index])
}

function App() {
  const [namesText, setNamesText] = useState(starterNames.join('\n'))
  const [excluded, setExcluded] = useState<string[]>([])
  const [drawResult, setDrawResult] = useState('尚未抽籤')
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawHistory, setDrawHistory] = useState<string[]>([])

  const [teams, setTeams] = useState<Team[]>([
    { id: 1, name: '第一組', score: 0 },
    { id: 2, name: '第二組', score: 0 },
    { id: 3, name: '第三組', score: 0 },
    { id: 4, name: '第四組', score: 0 },
  ])

  const [timerPreset, setTimerPreset] = useState(180)
  const [secondsLeft, setSecondsLeft] = useState(180)
  const [timerRunning, setTimerRunning] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)

  const [answers, setAnswers] = useState<Record<number, number[]>>({})
  const [submitted, setSubmitted] = useState(false)

  const [pollQuestion, setPollQuestion] = useState('今天這堂課你最想先用哪個工具？')
  const [pollOptionsText, setPollOptionsText] = useState('抽籤機\n記分板\n計時器\n測驗系統')
  const [pollVotes, setPollVotes] = useState<Record<string, number>>({})

  const names = useMemo(
    () => namesText.split('\n').map((name) => name.trim()).filter(Boolean),
    [namesText],
  )
  const availableNames = names.filter((name) => !excluded.includes(name))
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score)
  const leader = sortedTeams[0]
  const pollOptions = pollOptionsText.split('\n').map((option) => option.trim()).filter(Boolean)
  const totalVotes = Object.values(pollVotes).reduce((sum, votes) => sum + votes, 0)

  useEffect(() => {
    if (!timerRunning) return
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setTimerRunning(false)
          playBeep()
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [timerRunning])

  function playBeep() {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    audioRef.current = audioRef.current ?? new AudioContextClass()
    const oscillator = audioRef.current.createOscillator()
    const gain = audioRef.current.createGain()
    oscillator.frequency.value = 880
    oscillator.connect(gain)
    gain.connect(audioRef.current.destination)
    oscillator.start()
    gain.gain.exponentialRampToValueAtTime(0.0001, audioRef.current.currentTime + 0.7)
    oscillator.stop(audioRef.current.currentTime + 0.7)
  }

  function drawName() {
    if (availableNames.length === 0) {
      setDrawResult('名單已抽完，請重置排除名單')
      return
    }
    setIsDrawing(true)
    let ticks = 0
    const interval = window.setInterval(() => {
      const name = availableNames[Math.floor(Math.random() * availableNames.length)]
      setDrawResult(name)
      ticks += 1
      if (ticks > 18) {
        window.clearInterval(interval)
        setIsDrawing(false)
        setDrawHistory((history) => [name, ...history].slice(0, 8))
      }
    }, 80)
  }

  function updateTeamScore(id: number, delta: number) {
    setTeams((current) => current.map((team) => (team.id === id ? { ...team, score: team.score + delta } : team)))
  }

  function updateTeamName(id: number, name: string) {
    setTeams((current) => current.map((team) => (team.id === id ? { ...team, name } : team)))
  }

  function addTeam() {
    setTeams((current) => [...current, { id: Date.now(), name: `第 ${current.length + 1} 組`, score: 0 }])
  }

  function formatTime(value: number) {
    const minutes = Math.floor(value / 60).toString().padStart(2, '0')
    const seconds = (value % 60).toString().padStart(2, '0')
    return `${minutes}:${seconds}`
  }

  function setPreset(value: number) {
    setTimerPreset(value)
    setSecondsLeft(value)
    setTimerRunning(false)
  }

  function toggleAnswer(question: Question, optionIndex: number) {
    if (submitted) return
    setAnswers((current) => {
      const existing = current[question.id] ?? []
      if (question.type === 'multiple') {
        return {
          ...current,
          [question.id]: existing.includes(optionIndex)
            ? existing.filter((value) => value !== optionIndex)
            : [...existing, optionIndex],
        }
      }
      return { ...current, [question.id]: [optionIndex] }
    })
  }

  const score = starterQuestions.reduce((sum, question) => {
    return sum + (arraysEqual(answers[question.id] ?? [], question.answer) ? 1 : 0)
  }, 0)

  function vote(option: string) {
    setPollVotes((current) => ({ ...current, [option]: (current[option] ?? 0) + 1 }))
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Classroom Interactive MVP</p>
          <h1>課堂互動工具箱</h1>
          <p>抽籤、記分、計時、測驗與即時問答整合在同一個教室用頁面。</p>
        </div>
        <div className="hero-stats">
          <strong>{names.length}</strong>
          <span>名單項目</span>
          <strong>{teams.length}</strong>
          <span>競賽小組</span>
        </div>
      </section>

      <div className="grid two-columns">
        <section className="panel draw-panel">
          <div className="panel-heading">
            <p className="eyebrow">01 Random Picker</p>
            <h2>隨機抽籤機</h2>
          </div>
          <textarea value={namesText} onChange={(event) => setNamesText(event.target.value)} aria-label="抽籤名單" />
          <div className={`draw-result ${isDrawing ? 'spinning' : ''}`}>{drawResult}</div>
          <div className="button-row">
            <button onClick={drawName}>開始抽籤</button>
            <button className="secondary" onClick={() => setExcluded((current) => [...new Set([...current, drawResult])])} disabled={!names.includes(drawResult)}>
              排除本次結果
            </button>
            <button className="ghost" onClick={() => setExcluded([])}>重置排除</button>
          </div>
          <p className="muted">可抽：{availableNames.length}／已排除：{excluded.length}</p>
          <div className="history">{drawHistory.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}</div>
        </section>

        <section className="panel scoreboard-panel">
          <div className="panel-heading">
            <p className="eyebrow">02 Scoreboard</p>
            <h2>小組競賽記分板</h2>
          </div>
          <div className="leader-card">目前領先：<strong>{leader?.name}</strong> ／ {leader?.score ?? 0} 分</div>
          <div className="team-list">
            {sortedTeams.map((team, index) => (
              <article className="team-card" key={team.id}>
                <span className="rank">#{index + 1}</span>
                <input value={team.name} onChange={(event) => updateTeamName(team.id, event.target.value)} aria-label="小組名稱" />
                <strong>{team.score}</strong>
                <div className="score-actions">
                  <button onClick={() => updateTeamScore(team.id, 1)}>+1</button>
                  <button onClick={() => updateTeamScore(team.id, 5)}>+5</button>
                  <button className="secondary" onClick={() => updateTeamScore(team.id, -1)}>-1</button>
                </div>
              </article>
            ))}
          </div>
          <div className="button-row">
            <button onClick={addTeam}>新增小組</button>
            <button className="ghost" onClick={() => setTeams((current) => current.map((team) => ({ ...team, score: 0 })))}>清空分數</button>
          </div>
        </section>
      </div>

      <div className="grid two-columns">
        <section className={`panel timer-panel ${secondsLeft <= 10 ? 'urgent' : ''}`}>
          <div className="panel-heading">
            <p className="eyebrow">03 Timer</p>
            <h2>小組報告計時器</h2>
          </div>
          <div className="preset-row">
            {[180, 300, 600].map((value) => <button className={timerPreset === value ? '' : 'secondary'} key={value} onClick={() => setPreset(value)}>{value / 60} 分</button>)}
          </div>
          <div className="time-display">{formatTime(secondsLeft)}</div>
          <input type="range" min="30" max="900" step="30" value={timerPreset} onChange={(event) => setPreset(Number(event.target.value))} />
          <div className="button-row center">
            <button onClick={() => setTimerRunning(true)}>開始</button>
            <button className="secondary" onClick={() => setTimerRunning(false)}>暫停</button>
            <button className="ghost" onClick={() => setPreset(timerPreset)}>重置</button>
          </div>
        </section>

        <section className="panel poll-panel">
          <div className="panel-heading">
            <p className="eyebrow">04 Real-time Q&A</p>
            <h2>即時反饋</h2>
          </div>
          <input value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} aria-label="投票題目" />
          <textarea value={pollOptionsText} onChange={(event) => setPollOptionsText(event.target.value)} aria-label="投票選項" />
          <h3>{pollQuestion}</h3>
          {pollOptions.map((option) => {
            const votes = pollVotes[option] ?? 0
            const percent = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100)
            return (
              <div className="poll-option" key={option}>
                <button onClick={() => vote(option)}>{option}</button>
                <div className="bar"><span style={{ width: `${percent}%` }} /></div>
                <strong>{percent}%</strong>
              </div>
            )
          })}
          <button className="ghost" onClick={() => setPollVotes({})}>清除投票</button>
        </section>
      </div>

      <section className="panel exam-panel">
        <div className="panel-heading">
          <p className="eyebrow">05 Exam System</p>
          <h2>互動測驗卷與自動閱卷</h2>
        </div>
        <div className="progress">作答進度：{Object.keys(answers).length} / {starterQuestions.length}</div>
        {starterQuestions.map((question, questionIndex) => (
          <article className="question-card" key={question.id}>
            <div className="question-title">
              <span>第 {questionIndex + 1} 題</span>
              <h3>{question.title}</h3>
            </div>
            <div className="option-grid">
              {question.options.map((option, optionIndex) => {
                const selected = (answers[question.id] ?? []).includes(optionIndex)
                const correct = submitted && question.answer.includes(optionIndex)
                const wrong = submitted && selected && !question.answer.includes(optionIndex)
                return (
                  <button
                    className={`option ${selected ? 'selected' : ''} ${correct ? 'correct' : ''} ${wrong ? 'wrong' : ''}`}
                    key={option}
                    onClick={() => toggleAnswer(question, optionIndex)}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
            {submitted && (
              <p className="feedback">
                {arraysEqual(answers[question.id] ?? [], question.answer) ? '答對。' : '再想想。'}
                正確答案：{question.answer.map((index) => question.options[index]).join('、')}。{question.explanation}
              </p>
            )}
          </article>
        ))}
        <div className="exam-footer">
          {submitted && <div className="score-badge">得分 {score} / {starterQuestions.length}</div>}
          <button onClick={() => setSubmitted(true)}>提交並自動閱卷</button>
          <button className="ghost" onClick={() => { setAnswers({}); setSubmitted(false) }}>重新作答</button>
        </div>
      </section>
    </main>
  )
}

export default App
