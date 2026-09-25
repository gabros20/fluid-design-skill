// settings.mjs — fluid settings [--json]

import { normaliseStructure, settingsSpec } from '../../lib/spec.mjs'
import { settingsReferenceCss } from '../../lib/emit/project.mjs'
import { findConfig, project } from '../project.mjs'

export function cmdSettings(flags) {
  const path = findConfig(flags)
  const structure = path ? project(flags).structure : normaliseStructure({})
  if (flags.json) console.log(JSON.stringify(settingsSpec(structure).map(({ name, band, default: d, min, max, registered, doc }) => ({ name, band, default: d, min, max, registered, doc })), null, 2))
  else process.stdout.write(settingsReferenceCss(structure))
}
