import { Dimensions, PixelRatio } from 'react-native';

import { computeBoardMetricsWith, type BoardMetrics } from '../game/boardMetrics';

/**
 * Platform binding for the board geometry.
 *
 * The arithmetic lives in `game/boardMetrics.ts` so it can be unit-tested on
 * Node; this file only supplies the device pixel rounding and the initial
 * viewport read.
 */

export {
  BOARD_PADDING,
  CELL_GAP,
  CHROME_HEIGHT,
  MAX_BOARD_WIDTH,
  MIN_BOARD_SIZE,
  type BoardMetrics,
} from '../game/boardMetrics';

export function computeBoardMetrics(width: number, height: number): BoardMetrics {
  return computeBoardMetricsWith(width, height, (v) => PixelRatio.roundToNearestPixel(v));
}

const initial = Dimensions.get('window');
export const DEFAULT_METRICS = computeBoardMetrics(initial.width, initial.height);
