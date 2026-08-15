import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@linxin666/dsh-balance', [
  'src/index.ts',
  'src/invariant.ts',
], {
  libExternal: ['@deepseek-ai/dsh-settings', '@deepseek-ai/dsh-credentials'],
})
