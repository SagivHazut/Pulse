import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBackdrop } from '../components/animations/AnimatedBackdrop';
import { ComboBadge } from '../components/animations/ComboBadge';
import { ParticleField } from '../components/animations/Particles';
import { ScoreFly } from '../components/animations/ScoreFly';
import { Board } from '../components/game/Board';
import { DragLayer } from '../components/game/DragLayer';
import { DragProvider, type PreviewState } from '../components/game/DragContext';
import { PieceTray } from '../components/game/PieceTray';
import { PowerUpBar } from '../components/game/PowerUpBar';
import { PowerUpShopSheet } from '../components/game/PowerUpShopSheet';
import { ComboStrip } from '../components/game/ComboStrip';
import { PulseMeter } from '../components/game/PulseMeter';
import { ScoreHud } from '../components/game/ScoreHud';
import { GAME_CONFIG } from '../constants/config';
import { getMode } from '../game/modes';
import { useTheme } from '../hooks/useTheme';
import { showRewarded } from '../services/ads';
import { startMusic } from '../services/audio';
import { useGameStore } from '../stores/useGameStore';
import { useMonetizationStore } from '../stores/useMonetizationStore';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useRouterStore } from '../stores/useRouterStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { showToast } from '../stores/useUiStore';
import { SPACING } from '../theme/tokens';
import type { Coord, Piece, PowerUpKind } from '../types';
import { computeBoardMetrics } from '../utils/layout';
import { GameOverSheet } from './GameOverSheet';
import { TutorialOverlay } from './TutorialOverlay';

/**
 * The play screen.
 *
 * It owns the geometry (board metrics, measured origins) and the effects layer,
 * then hands both to the drag system through context. Gameplay rules live in the
 * store and the engine — nothing here decides what a move does.
 */
export function GameScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const go = useRouterStore((s) => s.go);

  const metrics = useMemo(() => computeBoardMetrics(width, height), [width, height]);

  const board = useGameStore((s) => s.board);
  const tray = useGameStore((s) => s.tray);
  const status = useGameStore((s) => s.status);
  const score = useGameStore((s) => s.score);
  const combo = useGameStore((s) => s.combo);
  const pulseMeter = useGameStore((s) => s.pulseMeter);
  const freezeCharges = useGameStore((s) => s.freezeCharges);
  const clearingCells = useGameStore((s) => s.clearingCells);
  const lastClear = useGameStore((s) => s.lastClear);
  const lastAward = useGameStore((s) => s.lastAward);
  const occupancyGrid = useGameStore((s) => s.occupancyGrid);
  const tension = useGameStore((s) => s.tension);
  const powerUps = useGameStore((s) => s.powerUps);
  const armedPowerUp = useGameStore((s) => s.armedPowerUp);
  const invalidNonce = useGameStore((s) => s.invalidNonce);

  const placePieceAt = useGameStore((s) => s.placePieceAt);
  const registerInvalidDrop = useGameStore((s) => s.registerInvalidDrop);
  const armPowerUp = useGameStore((s) => s.armPowerUp);
  const applyArmedPowerUp = useGameStore((s) => s.applyArmedPowerUp);
  const shuffleHand = useGameStore((s) => s.shuffleHand);
  const grantPowerUp = useGameStore((s) => s.grantPowerUp);
  const buyPowerUp = useGameStore((s) => s.buyPowerUp);

  const mode = useGameStore((s) => s.mode);
  const highScore = usePlayerStore((s) => s.highScores[mode]);
  const coins = usePlayerStore((s) => s.totalCoins);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  const canOfferRescue = useMonetizationStore((s) => s.canOfferRescue);
  const registerRescueOffer = useMonetizationStore((s) => s.registerRescueOffer);
  const setAdInFlight = useMonetizationStore((s) => s.setAdInFlight);
  const rescueOffersUsed = useMonetizationStore((s) => s.rescueOffersUsed);

  // ---------------------------------------------------------------- geometry
  const rootRef = useRef<View>(null);
  const gridRef = useRef<View>(null);
  const boardOrigin = useSharedValue({ x: 0, y: 0 });
  const rootOrigin = useSharedValue({ x: 0, y: 0 });
  /**
   * Window positions mirrored into React state as well as shared values: the
   * worklets need the shared values, and the effects layer needs plain numbers
   * it can read during render. Both only change on layout, never per frame.
   */
  const [rootWindow, setRootWindow] = useState({ x: 0, y: 0 });
  const [boardWindow, setBoardWindow] = useState({ x: 0, y: 0 });
  const [scoreWindow, setScoreWindow] = useState({ x: width / 2, y: 90 });

  const occupancy = useSharedValue<number[]>(occupancyGrid);
  useEffect(() => {
    occupancy.value = occupancyGrid;
  }, [occupancyGrid, occupancy]);

  const measureRoot = useCallback(() => {
    rootRef.current?.measureInWindow((x, y) => {
      rootOrigin.value = { x, y };
      setRootWindow((prev) => (prev.x === x && prev.y === y ? prev : { x, y }));
    });
  }, [rootOrigin]);

  const measureGrid = useCallback(() => {
    gridRef.current?.measureInWindow((x, y) => {
      boardOrigin.value = { x, y };
      setBoardWindow((prev) => (prev.x === x && prev.y === y ? prev : { x, y }));
    });
    measureRoot();
  }, [boardOrigin, measureRoot]);

  // Re-measure on rotation / size change.
  useEffect(() => {
    const timer = setTimeout(measureGrid, 60);
    return () => clearTimeout(timer);
  }, [measureGrid, width, height]);

  // ------------------------------------------------------------------- drag
  const [shopOpen, setShopOpen] = useState(false);
  const [shopBusy, setShopBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [draggingPiece, setDraggingPiece] = useState<Piece | null>(null);

  const centerX = useSharedValue(0);
  const centerY = useSharedValue(0);
  const dragScale = useSharedValue(1);
  const wobble = useSharedValue(0);
  const active = useSharedValue(0);
  const session = useSharedValue(0);
  // Shared values keep their identity across renders, so this bag is stable —
  // which matters, because an unstable `motion` would rebuild every gesture.
  const motion = useMemo(
    () => ({ centerX, centerY, scale: dragScale, wobble, active, session }),
    [centerX, centerY, dragScale, wobble, active, session],
  );

  const handleDrop = useCallback(
    (pieceId: string, row: number, col: number) => {
      placePieceAt(pieceId, row, col);
    },
    [placePieceAt],
  );

  const dragValue = useMemo(
    () => ({
      metrics,
      rows: GAME_CONFIG.rows,
      columns: GAME_CONFIG.columns,
      boardOrigin,
      rootOrigin,
      occupancy,
      motion,
      preview,
      setPreview,
      draggingPiece,
      setDraggingPiece,
      onDrop: handleDrop,
      onInvalidDrop: registerInvalidDrop,
      /**
       * Deliberately still enabled while a clear is animating. The store flushes
       * the pending clear when a new piece lands, so the player is never made to
       * wait out an animation before their next move.
       */
      enabled: (status === 'playing' || status === 'clearing') && !armedPowerUp,
    }),
    [
      metrics,
      boardOrigin,
      rootOrigin,
      occupancy,
      motion,
      preview,
      draggingPiece,
      handleDrop,
      registerInvalidDrop,
      status,
      armedPowerUp,
    ],
  );

  /**
   * This screen is meaningless without a run. If it is ever shown with an idle
   * store — a hot reload in development recreates the store module and does
   * exactly that — bounce to Home rather than presenting an empty board with a
   * dead tray, which reads as a broken game. Home still offers CONTINUE, so a
   * saved session is not lost.
   */
  useEffect(() => {
    if (status === 'idle') go('home');
  }, [status, go]);

  // ---------------------------------------------------------------- effects
  const shake = useSharedValue(0);
  const flash = useSharedValue(0);

  useEffect(() => {
    if (!lastClear || reducedMotion) return;
    const strength = lastClear.tier === 'dramatic' ? 1 : lastClear.tier === 'hype' ? 0.55 : 0;
    if (strength > 0) {
      shake.value = withSequence(
        withTiming(strength, { duration: 45 }),
        withTiming(-strength, { duration: 55 }),
        withTiming(strength * 0.5, { duration: 55 }),
        withTiming(0, { duration: 60 }),
      );
    }
    if (lastClear.tier === 'dramatic' || lastClear.perfectClear) {
      flash.value = withSequence(
        withTiming(0.5, { duration: 90 }),
        withTiming(0, { duration: 260 }),
      );
    }
  }, [lastClear, reducedMotion, shake, flash]);

  useEffect(() => {
    if (invalidNonce === 0 || reducedMotion) return;
    shake.value = withSequence(
      withTiming(0.4, { duration: 40 }),
      withTiming(-0.4, { duration: 45 }),
      withTiming(0, { duration: 45 }),
    );
  }, [invalidNonce, reducedMotion, shake]);

  useEffect(() => {
    if (!lastAward) return;
    showToast(`Pulse full — free ${lastAward.kind} power-up!`, 'success');
  }, [lastAward]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value * 7 }, { translateY: shake.value * 3 }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  /** Burst origins in effects-layer coordinates. */
  const particlePoints = useMemo(() => {
    if (!lastClear) return [];
    const originX = boardWindow.x - rootWindow.x;
    const originY = boardWindow.y - rootWindow.y;
    return lastClear.cells.map((cell) => ({
      x: originX + cell.col * metrics.cellStride + metrics.cellSize / 2,
      y: originY + cell.row * metrics.cellStride + metrics.cellSize / 2,
    }));
  }, [lastClear, metrics, boardWindow, rootWindow]);

  const scoreAnchor = useMemo(
    () => ({ x: scoreWindow.x - rootWindow.x, y: scoreWindow.y - rootWindow.y }),
    [scoreWindow, rootWindow],
  );

  const flyOrigin = useMemo(() => {
    if (particlePoints.length === 0) return { x: 0, y: 0 };
    const sum = particlePoints.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 },
    );
    return { x: sum.x / particlePoints.length - 40, y: sum.y / particlePoints.length - 16 };
  }, [particlePoints]);

  // ------------------------------------------------------------------ input
  const handleCellPress = useCallback(
    (coord: Coord) => {
      if (!applyArmedPowerUp(coord)) {
        showToast('Nothing to clear there', 'warning');
      }
    },
    [applyArmedPowerUp],
  );

  const handleSelectPowerUp = useCallback(
    (kind: PowerUpKind) => {
      if (kind === 'shuffle') {
        if (!shuffleHand()) showToast('No refreshes left', 'warning');
        return;
      }
      armPowerUp(kind);
    },
    [armPowerUp, shuffleHand],
  );

  const handleRescue = useCallback(async () => {
    if (shopBusy) return;
    setShopBusy(true);
    registerRescueOffer();
    setAdInFlight(true);
    const kind: PowerUpKind = Math.random() < 0.5 ? 'bomb' : 'lightning';
    const result = await showRewarded('rescue_powerup', () => grantPowerUp(kind));
    setAdInFlight(false);
    setShopBusy(false);
    if (result.earned) showToast(`${kind === 'bomb' ? 'Bomb' : 'Bolt'} added!`, 'success');
    else if (result.message) showToast(result.message, 'warning');
  }, [grantPowerUp, registerRescueOffer, setAdInFlight, shopBusy]);

  const handleBuy = useCallback(
    (kind: PowerUpKind, quantity: number) => {
      if (buyPowerUp(kind, quantity)) {
        showToast(`${quantity}× ${kind} added`, 'success');
      } else {
        showToast('Not enough coins', 'warning');
      }
    },
    [buyPowerUp],
  );

  useEffect(() => {
    startMusic();
  }, []);

  const modeConfig = getMode(mode);
  const boardTop = insets.top + (metrics.isCompact ? 84 : 104);

  return (
    <View
      ref={rootRef}
      onLayout={measureRoot}
      collapsable={false}
      style={[styles.root, { backgroundColor: theme.colors.background }]}
    >
      <AnimatedBackdrop tension={tension} animated={false} reducedMotion={reducedMotion} />

      <DragProvider value={dragValue}>
        <View
          style={[
            styles.content,
            { paddingTop: insets.top + SPACING.xs, paddingBottom: Math.max(insets.bottom, SPACING.md) },
          ]}
          pointerEvents="box-none"
        >
          <ScoreHud
            score={score}
            highScore={highScore}
            coins={coins}
            reducedMotion={reducedMotion}
            onSettings={() => go('settings')}
            onHome={() => go('home')}
            onScoreAnchor={(x, y) =>
              setScoreWindow((prev) => (prev.x === x && prev.y === y ? prev : { x, y }))
            }
          />

          <Animated.View style={[styles.boardWrap, shakeStyle]}>
            <Board
              board={board}
              clearingCells={clearingCells}
              metrics={metrics}
              preview={preview}
              draggingPiece={draggingPiece}
              tension={tension}
              armedPowerUp={armedPowerUp}
              reducedMotion={reducedMotion}
              onGridLayout={measureGrid}
              onCellPress={handleCellPress}
              gridRef={gridRef}
            />
          </Animated.View>

          <View style={styles.lower}>
            <TutorialOverlay />
            {/*
              Classic shows only the combo — no Pulse meter to fill and no
              toolbar to fill it for. The board gets the space instead.
            */}
            {modeConfig.pulseMeter ? (
              <PulseMeter
                value={pulseMeter}
                combo={combo}
                freezeCharges={freezeCharges}
                reducedMotion={reducedMotion}
              />
            ) : (
              <ComboStrip combo={combo} />
            )}
            <PieceTray tray={tray} board={board} metrics={metrics} />
            {modeConfig.powerUps ? (
              <PowerUpBar
                inventory={powerUps}
                armed={armedPowerUp}
                onSelect={handleSelectPowerUp}
                onOpenShop={() => setShopOpen(true)}
              />
            ) : null}
          </View>
        </View>

        {/* Effects sit above the board but below modals, and never take touches. */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <ParticleField
            nonce={lastClear?.id ?? 0}
            points={particlePoints}
            colors={theme.particles}
            intensity={lastClear?.tier === 'dramatic' ? 1.6 : lastClear?.tier === 'hype' ? 1.2 : 1}
            enabled={!reducedMotion}
          />
          <ScoreFly
            nonce={lastClear?.id ?? 0}
            points={lastClear?.points ?? 0}
            x={flyOrigin.x}
            y={flyOrigin.y}
            targetX={scoreAnchor.x - 30}
            targetY={scoreAnchor.y}
            emphasis={lastClear?.tier === 'dramatic' ? 1 : 0}
            reducedMotion={reducedMotion}
          />
          <View style={{ position: 'absolute', top: boardTop, left: 0, right: 0, height: metrics.boardSize }}>
            <ComboBadge
              nonce={lastClear?.id ?? 0}
              combo={lastClear?.combo ?? combo}
              tier={lastClear?.tier ?? 'none'}
              reducedMotion={reducedMotion}
            />
          </View>
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.accent }, flashStyle]}
          />
        </View>

        <DragLayer />
      </DragProvider>

      {modeConfig.powerUps ? (
        <PowerUpShopSheet
          visible={shopOpen}
          onClose={() => setShopOpen(false)}
          inventory={powerUps}
          coins={coins}
          onBuy={handleBuy}
          onWatchAd={handleRescue}
          adAvailable={canOfferRescue()}
          busy={shopBusy}
        />
      ) : null}

      {status === 'gameover' ? <GameOverSheet rescueOffersUsed={rescueOffersUsed} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  /**
   * Grows to fill whatever the HUD and tray leave over, keeping the board
   * optically centred. Without this, Classic — which has no Pulse meter and no
   * power-up bar — left the freed space as one dead band above the tray.
   */
  boardWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lower: { alignSelf: 'stretch', alignItems: 'center', gap: SPACING.sm },
});
