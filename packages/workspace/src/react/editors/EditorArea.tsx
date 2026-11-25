import { baseName } from '@tensorai-co/workspace/explorer'
import { Dialog } from '@tensorai-co/workspace/overlays'
import { Pane, Split } from '@tensorai-co/workspace/split'
import type { CommandRegistry } from '../../core/index.js'
import { EditorGroup } from './EditorGroup.js'
import type { Editors } from './useEditors.js'

/** The editor groups side by side, and the question asked before closing a file with changes. */
export function EditorArea({ editors, commands }: { editors: Editors; commands: CommandRegistry }) {
  const { closing } = editors
  return (
    <>
      <Split direction="row">
        {editors.groups.map((g) => (
          <Pane key={g.id} id={`group-${g.id}`} min={220}>
            <EditorGroup group={g} editors={editors} commands={commands} />
          </Pane>
        ))}
      </Split>
      {closing && (
        <Dialog
          message={`Do you want to save the changes you made to ${baseName(closing.ids[0]!)}?`}
          detail="Your changes will be lost if you don't save them."
          buttons={[
            { label: 'Save', value: 'save' },
            { label: 'Cancel', value: 'cancel' },
            { label: "Don't Save", value: 'discard' },
          ]}
          onAnswer={(value) => void editors.answer(value)}
        />
      )}
    </>
  )
}
