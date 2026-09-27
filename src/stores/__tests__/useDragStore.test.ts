import type { Piece } from '../../types';
import {
  releaseDraggingPiece,
  resetDrag,
  setDragPreview,
  setDraggingPiece,
  useDragStore,
} from '../useDragStore';

const piece = (id: string): Piece => ({
  id,
  shapeId: 'i2-h',
  cells: [
    { r: 0, c: 0, power: null },
    { r: 0, c: 1, power: null },
  ],
  width: 2,
  height: 1,
  colorId: 'aqua',
});

beforeEach(() => resetDrag());

describe('drag ownership', () => {
  // The fly-home of a rejected drop finishes a few hundred ms later. If the
  // player has already grabbed another piece by then, that late callback must
  // leave the new drag alone — releasing it hid the piece under their finger.
  it('lets only the owning piece release the drag layer', () => {
    setDraggingPiece(piece('b'));
    releaseDraggingPiece('a');
    expect(useDragStore.getState().draggingPiece?.id).toBe('b');

    releaseDraggingPiece('b');
    expect(useDragStore.getState().draggingPiece).toBeNull();
  });
});

describe('preview updates', () => {
  it('does not notify subscribers when the snapped target is unchanged', () => {
    const seen: unknown[] = [];
    const unsubscribe = useDragStore.subscribe((state) => seen.push(state.preview));

    setDragPreview({ row: 2, col: 3, valid: true });
    // A fresh object with the same contents — what the gesture sends when the
    // finger moves within one cell.
    setDragPreview({ row: 2, col: 3, valid: true });
    setDragPreview({ row: 2, col: 3, valid: true });
    setDragPreview({ row: 2, col: 4, valid: true });
    setDragPreview({ row: 2, col: 4, valid: false });
    setDragPreview(null);
    setDragPreview(null);

    unsubscribe();
    expect(seen).toEqual([
      { row: 2, col: 3, valid: true },
      { row: 2, col: 4, valid: true },
      { row: 2, col: 4, valid: false },
      null,
    ]);
  });
});
