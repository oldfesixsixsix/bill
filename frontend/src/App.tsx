import { useState } from 'react'
import { CategorySpendingChart } from './components/CategorySpendingChart'
import { DailyReceipt } from './components/DailyReceipt'

type View = 'chart' | 'receipt'

function App() {
  const [view, setView] = useState<View>('chart')

  return (
    <main style={{ maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
      <nav style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button type="button" onClick={() => setView('chart')} disabled={view === 'chart'}>
          類別開銷
        </button>
        <button type="button" onClick={() => setView('receipt')} disabled={view === 'receipt'}>
          每日收據
        </button>
      </nav>

      {view === 'chart' ? <CategorySpendingChart /> : <DailyReceipt />}
    </main>
  )
}

export default App
