import React from 'react'
import ReactDOM from 'react-dom/client'
import DesktopApp from './DesktopApp'
import '../../code/styles/globals.css'

// Error boundary for startup
window.onerror = function(message, source, lineno, colno, error) {
  const div = document.createElement('div');
  div.style.color = 'red';
  div.style.backgroundColor = 'white';
  div.style.padding = '20px';
  div.style.position = 'absolute';
  div.style.top = '0';
  div.style.left = '0';
  div.style.zIndex = '9999';
  div.innerText = `Error: ${message}\nSource: ${source}:${lineno}`;
  document.body.appendChild(div);
};

document.documentElement.classList.add('dark')
// document.body.classList.add('transparent-window')
document.body.style.backgroundColor = '#000000'; // Force black background

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesktopApp />
  </React.StrictMode>,
)
