import { useEffect } from 'react'
export default function Lazy() {
  useEffect(() => { (window as any).__HYDRATED__ = true }, [])
  return <p id="lazy">lazy loaded</p>
}
