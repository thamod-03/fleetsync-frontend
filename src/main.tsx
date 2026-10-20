import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeApplicationServices } from './services/application-services'
import { ErrorState } from './components/ui/page-states'

const root = createRoot(document.getElementById('root')!)
void initializeApplicationServices().then(() => root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)).catch(() => root.render(<ErrorState message="FleetSync could not be loaded. Reload the page to try again." />))
