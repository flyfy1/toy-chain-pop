import { useEffect, useRef, useState } from 'react'
import { MoreMenu } from './components/MoreMenu'
import { applyMeta, t } from './i18n'
import { startAnalytics, track } from './analytics'
import { landing, trackLanding } from './share'
import { Tag } from './components/Tag'

/** a challenge link's time (pop and void carry the sender's seconds as `t`) */
const RIVAL = (() => {
  // same rule as rivalTime in cards.ts: rounded to 0.1, nothing for a mad number
  const v = landing.recipient ? Number(new URLSearchParams(location.search).get('t')) : 0
  return v > 0 && v < 3600 ? Math.round(v * 10) / 10 : 0
})()
import { Hint } from './components/Hint'
import { startGame } from './game'

export default function App() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    applyMeta('pop')
    startAnalytics('pop')
    trackLanding()
    return startGame(ref.current!, () => {
      setTouched(true)
      track('play_start')
    })
  }, [])
  return (
    <>
      <canvas ref={ref} />
      <Hint text={t('hint_pop')} hidden={touched} toy="pop" />
      {RIVAL > 0 && <Tag text={t('pop_tag', { s: RIVAL })} className="top-16" paper="bg-[#FFFDF7] text-[#1E1E1E] font-medium" />}
      <MoreMenu current="pop" />
    </>
  )
}
