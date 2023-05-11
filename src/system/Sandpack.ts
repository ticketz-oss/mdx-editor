import { system } from '../gurx'
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_LOW, FOCUS_COMMAND } from 'lexical'
import { EditorSystemType } from './Editor'
import React from 'react'
import { SandpackProvider } from '@codesandbox/sandpack-react'
import { $createSandpackNode } from '../nodes/Sandpack'
import { $insertNodeToNearestRoot } from '@lexical/utils'
import { CodeBlockMeta } from '../types/CodeBlockMeta'
import { $createCodeBlockNode } from '../nodes'

export type Dependencies = Record<string, string>
type SandpackProviderProps = React.ComponentProps<typeof SandpackProvider>

export type DependencySet = {
  name: string
  dependencies: Dependencies
}

export type FileSet = {
  name: string
  files: Record<string, string>
}

export interface SandpackPreset {
  name: string
  sandpackTemplate: SandpackProviderProps['template']
  sandpackTheme: SandpackProviderProps['theme']
  snippetFileName: string
  dependencies?: Dependencies
  files?: Record<string, string>
  additionalDependencySets?: Array<DependencySet>
  additionalFileSets?: Array<FileSet>
  defaultSnippetLanguage?: string
  defaultSnippetContent?: string
}

export interface SandpackConfig {
  defaultPreset: string
  presets: Array<SandpackPreset>
}

export type SandpackConfigValue = SandpackConfig | ((meta: CodeBlockMeta) => SandpackPreset)

const defaultSnippetContent = `
export default function App() {
  return (
    <div className="App">
      <h1>Hello CodeSandbox</h1>
      <h2>Start editing to see some magic happen!</h2>
    </div>
  );
}
`

const defaultSandpackConfig: SandpackConfig = {
  defaultPreset: 'react',
  presets: [
    {
      name: 'react',
      sandpackTemplate: 'react',
      sandpackTheme: 'light',
      snippetFileName: '/App.js',
      defaultSnippetLanguage: 'jsx',
      defaultSnippetContent,
    },
  ],
}
export const [SandpackSystem] = system(
  (r, [{ activeEditor, activeEditorType, createEditorSubscription }]) => {
    const sandpackConfig = r.node<SandpackConfigValue>(defaultSandpackConfig)
    const insertSandpack = r.node<true>()
    const insertCodeBlock = r.node<true>()

    // clear the node when the regular editor is focused.
    r.pub(createEditorSubscription, (editor) => {
      return editor.registerCommand(
        FOCUS_COMMAND,
        () => {
          r.pub(activeEditorType, { type: 'lexical' })
          return false
        },
        COMMAND_PRIORITY_LOW
      )
    })

    r.sub(r.pipe(insertSandpack, r.o.withLatestFrom(activeEditor, sandpackConfig)), ([, theEditor, sandpackConfig]) => {
      theEditor?.getEditorState().read(() => {
        const selection = $getSelection()

        if ($isRangeSelection(selection)) {
          const focusNode = selection.focus.getNode()

          const defaultPreset =
            typeof sandpackConfig === 'function'
              ? sandpackConfig({})
              : sandpackConfig.presets.find((preset) => preset.name === sandpackConfig.defaultPreset)
          if (!defaultPreset) {
            throw new Error('No default sandpack preset found')
          }

          if (focusNode !== null) {
            theEditor.update(() => {
              const sandpackNode = $createSandpackNode({
                code: defaultPreset.defaultSnippetContent || '',
                language: defaultPreset.defaultSnippetLanguage || 'jsx',
                meta: 'live',
              })

              $insertNodeToNearestRoot(sandpackNode)
              // TODO: hack, decoration is not synchronous ;(
              setTimeout(() => sandpackNode.select(), 80)
            })
          }
        }
      })
    })

    r.sub(r.pipe(insertCodeBlock, r.o.withLatestFrom(activeEditor)), ([, theEditor]) => {
      theEditor?.getEditorState().read(() => {
        const selection = $getSelection()

        if ($isRangeSelection(selection)) {
          const focusNode = selection.focus.getNode()

          if (focusNode !== null) {
            theEditor.update(() => {
              const codeBlockNode = $createCodeBlockNode({
                code: '',
                language: 'jsx',
                meta: '',
              })

              $insertNodeToNearestRoot(codeBlockNode)
              // TODO: hack, decoration is not synchronous ;(
              setTimeout(() => codeBlockNode.select(), 80)
            })
          }
        }
      })
    })

    return {
      insertSandpack,
      insertCodeBlock,
      sandpackConfig,
    }
  },
  [EditorSystemType]
)