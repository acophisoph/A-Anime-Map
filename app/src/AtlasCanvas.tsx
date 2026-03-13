import { Application, Graphics } from 'pixi.js';
import { useEffect, useRef } from 'react';
import type { Point } from './types';

interface Props {
  points: Point[];
  mode: 'media' | 'people';
  onSelect: (id: number, kind: 0 | 1) => void;
}

export function AtlasCanvas({ points, mode, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const app = new Application();
    let mounted = true;
    void app.init({ background: '#05080f', resizeTo: hostRef.current, antialias: true }).then(() => {
      if (!mounted || !hostRef.current) return;
      hostRef.current.innerHTML = '';
      hostRef.current.appendChild(app.canvas);
      const g = new Graphics();
      for (const p of points) {
        if ((mode === 'media' && p.kind !== 0) || (mode === 'people' && p.kind !== 1)) continue;
        const color = p.kind === 0 ? 0x54c7ec : 0xff9f43;
        const x = p.x * 500 + app.screen.width / 2;
        const y = p.y * 500 + app.screen.height / 2;
        g.circle(x, y, 2.8).fill(color);
      }
      g.eventMode = 'static';
      g.hitArea = app.screen;
      g.on('pointerdown', (e) => {
        const { x, y } = e.global;
        let best: Point | undefined;
        let bestD = Infinity;
        for (const p of points) {
          if ((mode === 'media' && p.kind !== 0) || (mode === 'people' && p.kind !== 1)) continue;
          const px = p.x * 500 + app.screen.width / 2;
          const py = p.y * 500 + app.screen.height / 2;
          const d = (px - x) ** 2 + (py - y) ** 2;
          if (d < bestD) {
            best = p;
            bestD = d;
          }
        }
        if (best && bestD < 160) onSelect(best.id, best.kind);
      });
      app.stage.addChild(g);
    });

    return () => {
      mounted = false;
      app.destroy(true, { children: true });
    };
  }, [points, mode, onSelect]);

  return <div ref={hostRef} className="atlas-canvas" />;
}
