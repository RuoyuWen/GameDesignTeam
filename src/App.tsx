import { useState } from 'react'
import ConfigPage from './pages/ConfigPage'
import PipelinePage from './pages/PipelinePage'
import './App.css'

type Tab = 'pipeline' | 'config'

export default function App() {
  const [tab, setTab] = useState<Tab>('pipeline')

  return (
    <div className="app-shell">
      <nav className="app-nav" aria-label="主导航">
        <button
          type="button"
          className={tab === 'pipeline' ? 'active' : ''}
          onClick={() => setTab('pipeline')}
        >
          工作台
        </button>
        <button
          type="button"
          className={tab === 'config' ? 'active' : ''}
          onClick={() => setTab('config')}
        >
          API 与模型
        </button>
      </nav>
      <main className="app-main">
        {tab === 'config' ? <ConfigPage /> : <PipelinePage />}
      </main>
    </div>
  )
}
