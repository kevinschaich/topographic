import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from "@kevinschaich/components"
import { App } from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Toaster>
            <App />
        </Toaster>
    </StrictMode>,
)
