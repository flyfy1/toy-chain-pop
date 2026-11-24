import { useEffect, useRef, useState } from 'react'
import { MoreMenu } from './components/MoreMenu'
import { Hint } from './components/Hint'
import { startGame } from './game'

export default function App() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [touched, setTouched] = useState(false)
  useEffect(() => startGame(ref.current!, () => setTouched(true)), [])
  return (
    <>
      <canvas ref={ref} />
      <Hint text="点破泡泡 · 连点 5 个进入超载" hidden={touched} />
      <MoreMenu current="pop" />
    </>
  )
}
