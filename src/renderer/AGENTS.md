# src/renderer/ — Renderer UI

React UI for all internal views. Each UI surface is a separate webpack entry point rendering in its own Chromium process.

## Directory structure

- `components/` — reusable React components, each in a named directory (see component structure below).
- `modals/` — modal entry points. Each modal gets its own directory containing a thin wrapper that bootstraps the renderer (see "Adding a new renderer view").
- `hooks/` — custom React hooks (e.g., `useConfig` for reading app configuration via IPC).
- `css/` — global stylesheets. `css/base/` contains Sass variables, CSS custom properties, mixins, and typography. `css/index.scss` is the global entry point.
- Root `.tsx` files — top-level webpack entry points for non-modal surfaces (`index.tsx` for the main window, `dropdown.tsx`, `downloadsDropdown.tsx`, `popout.tsx`).
- `intl_provider.tsx` — shared `IntlProvider` wrapper that fetches the current locale on mount.

## Component conventions

**Functional components with hooks** are the standard. Some legacy class components exist (`MainPage`, `TabBar`, `NewServerModal`); new components should always be functional.

### File organization

Each component lives in a named directory under `components/`:

```
components/
  MyComponent/
    MyComponent.tsx    # component implementation
    MyComponent.scss   # co-located styles
    index.ts           # re-exports default + named exports
```

The `index.ts` re-exports so consumers import from the directory: `import MyComponent from 'renderer/components/MyComponent'`.

### Props

Define props as a `type` at the top of the file. Use `interface` only when extending HTML element attributes (e.g., `interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>`).

### Styling

- SCSS, co-located with the component and imported directly (`import './MyComponent.scss'`).
- Use CSS custom properties from `css/base/` for colors, spacing, elevation, and radii. Sass variables (`_variables.scss`) for anything not covered.
- Use `classnames` for conditional class application.
- No CSS-in-JS.

## State management

Component-local only (`useState`/`setState`). No global store. Cross-process state is communicated via IPC through `window.desktop` from the internal preload script.

## Internationalization

Each entry point wraps its root in `IntlProvider` (from `react-intl`), which fetches the current locale on mount. Language JSON files live in the project-root `i18n/` directory.

- Use `<FormattedMessage>` for rendered strings and `useIntl` / `intl.formatMessage` when a raw string is needed (e.g., `aria-label`, `placeholder`).
- Message IDs follow a dot-separated hierarchy reflecting their location: `renderer.components.errorView.troubleshooting...`.
- Always provide a `defaultMessage`.

## Adding a new renderer view

1. Create the React entry point (e.g., `src/renderer/modals/myModal/myModal.tsx`).
2. Add the entry to `webpack.config.renderer.js`.
3. Add an `HtmlWebpackPlugin` instance for it.
4. Access the desktop API via `window.desktop` — never import main-process modules directly.

### Modal entry point pattern

```tsx
// src/renderer/modals/myModal/myModal.tsx
import React from 'react';
import ReactDOM from 'react-dom';

import IntlProvider from 'renderer/intl_provider';

import MyModalComponent from '../../components/MyModalComponent';
import setupDarkMode from '../darkMode';

setupDarkMode();

const MyModalWrapper: React.FC = () => {
    return (
        <IntlProvider>
            <MyModalComponent
                onClose={() => window.desktop.modals.cancelModal()}
                onSave={(data) => window.desktop.modals.finishModal(data)}
            />
        </IntlProvider>
    );
};

ReactDOM.render(<MyModalWrapper/>, document.getElementById('app'));
```

Retrieve data passed from the main process with `window.desktop.modals.getModalInfo<T>()`.

### Webpack config for a new entry point

```javascript
// webpack.config.renderer.js — add both:
entry: {
    // ...existing entries...
    myModal: './src/renderer/modals/myModal/myModal.tsx',
},
plugins: [
    // ...existing plugins...
    new HtmlWebpackPlugin({
        title: 'Mattermost Desktop',
        template: 'src/renderer/index.html',
        chunks: ['myModal'],
        filename: 'myModal.html',
    }),
],
```

Then load from main process: `mattermost-desktop://renderer/myModal.html`.
