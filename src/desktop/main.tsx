import React from 'react'
import ReactDOM from 'react-dom/client'
import DesktopApp from './DesktopApp'
import '../../code/styles/globals.css'
document.documentElement.classList.add('dark')
document.body.classList.add('transparent-window')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesktopApp />
  </React.StrictMode>,
)
