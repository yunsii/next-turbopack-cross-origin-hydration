import { useState } from 'react'
import dynamic from 'next/dynamic'

// Dynamic import → the entry has otherChunks to wait on (needed to repro the
// entry's Promise.all hanging on a chunk whose resolver key never matches).
const Lazy = dynamic(() => import('../components/Lazy'), { ssr: true })

export default function Home() {
  const [n, setN] = useState(0)
  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1 id="h">Turbopack cross-origin hydration repro</h1>
      <p>
        If hydrated, the button increments on click and{' '}
        <code>window.__HYDRATED__ === true</code>. If not, clicking does nothing.
      </p>
      <button id="btn" onClick={() => setN(n + 1)}>
        count: {n}
      </button>
      <Lazy />
    </main>
  )
}
