import SpaceMapper from './components/SpaceMapper/SpaceMapper'
import { LanguageProvider } from './lib/i18n/LanguageProvider'
import { SelectionProvider } from './lib/selection/SelectionProvider'

function App() {
  return (
    <LanguageProvider>
      <SelectionProvider>
        <main className="mx-auto max-w-content px-sm pb-[130px] pt-lg sm:px-md">
          <SpaceMapper />
        </main>
      </SelectionProvider>
    </LanguageProvider>
  )
}

export default App
