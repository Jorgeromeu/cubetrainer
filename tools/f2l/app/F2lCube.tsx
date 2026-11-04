// A 3D cube drawn the way F2L's settings say (highlight pair, hint stickers): every cube on
// the F2L pages is one of these.
import { Cube, type CubeProps } from '../../../packages/ui/cube/Cube.tsx'
import { useF2lSettings } from './settings.ts'

export function F2lCube(props: Omit<CubeProps, 'display'>) {
  const { highlightPair, hints, hintDistance } = useF2lSettings()
  return <Cube {...props} display={{ highlightPair, hints, hintDistance }} />
}
