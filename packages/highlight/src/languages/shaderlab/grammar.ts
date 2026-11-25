import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  Shader Properties SubShader Pass Tags Category Fallback FallBack CustomEditor Dependency LOD Name
  UsePass GrabPass Stencil Cull ZWrite ZTest ZClip Offset Blend BlendOp ColorMask AlphaToMask Lighting
  Material SetTexture Fog Ref Comp ReadMask WriteMask Conservative HLSLINCLUDE CGINCLUDE PackageRequirements
`)
const CONSTANTS = words('On Off Back Front Less Greater LEqual GEqual Equal NotEqual Always Never One Zero SrcColor SrcAlpha DstColor DstAlpha OneMinusSrcColor OneMinusSrcAlpha OneMinusDstColor OneMinusDstAlpha Add Sub Min Max Keep Replace IncrSat DecrSat Invert')
const TYPES = words('Float Range Color Vector 2D 3D Cube 2DArray Int Integer')

// Unity ShaderLab: Shader blocks with Properties, SubShaders and Passes, and
// HLSL or Cg between HLSLPROGRAM/CGPROGRAM and ENDHLSL/ENDCG.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'comment' },
      { match: /(?:HLSLPROGRAM|CGPROGRAM|GLSLPROGRAM|HLSLINCLUDE|CGINCLUDE)\b/, token: 'keyword', push: 'program' },
      { match: /"/, token: 'string', push: 'string' },
      { match: /\[[A-Za-z]\w*(?:\([^)]*\))?\]/, token: 'meta' }, // [HDR], [Toggle(_X)]
      { match: /_[A-Za-z]\w*/, token: 'variable' }, // _MainTex, _Color
      { match: /[A-Za-z]\w*/, token: (t) => (KEYWORDS.has(t) ? 'keyword' : CONSTANTS.has(t) ? 'constant' : TYPES.has(t) ? 'type' : undefined) },
      { match: /2D(?:Array)?|3D/, token: 'type' },
      { match: /-?\d+(?:\.\d+)?/, token: 'number' },
      { match: /=/, token: 'operator' },
      { match: /[(){}[\],]/, token: 'punctuation' },
    ],
    // The program, to ENDHLSL or ENDCG, is HLSL.
    program: [
      { match: /^\s*(?:ENDHLSL|ENDCG|ENDGLSL)\b/, token: 'keyword', pop: true },
      { match: (line, pos) => (pos === 0 ? 0 : -1), push: '@hlsl' },
    ],
    string: [
      { match: /"/, token: 'string', pop: true },
      { match: /[^"]+/, token: 'string' },
    ],
    comment: [
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[^*]+|\*/, token: 'comment' },
    ],
  },
  embeds: {
    hlsl: { language: 'hlsl', end: /^(?=\s*(?:ENDHLSL|ENDCG|ENDGLSL)\b)/ },
  },
}
