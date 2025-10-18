import '../src/index.css'
import { ThemeProvider } from '../src/context/ThemeContext'

export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
}

export const decorators = [
  // eslint-disable-next-line no-unused-vars
  (StoryFn) => (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-foreground p-6">
        <StoryFn />
      </div>
    </ThemeProvider>
  ),
]
