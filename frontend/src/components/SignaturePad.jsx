// Phase 3 (B7) – finger / mouse signature pad on a <canvas> (pointer events, so touch + pen + mouse).
// Parent gets the drawing through the ref: ref.current.toDataURL(), .clear(), .isEmpty(), .load(dataUrl).
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

const SignaturePad = forwardRef(function SignaturePad({ onChange, height = 200 }, ref) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const inked = useRef(false);

  // White background so the PNG is readable on the certificate (transparent PNGs print black on some viewers)
  const paintBackground = useCallback(() => {
    const c = canvasRef.current;
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.restore();
  }, []);

  const setup = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const { width } = c.getBoundingClientRect();
    const snapshot = inked.current ? c.toDataURL('image/png') : null;
    c.width = Math.round(width * ratio);
    c.height = Math.round(height * ratio);
    const ctx = c.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    paintBackground();
    if (snapshot) drawImage(snapshot);
  }, [height, paintBackground]); // eslint-disable-line react-hooks/exhaustive-deps

  function drawImage(dataUrl) {
    const c = canvasRef.current;
    const img = new Image();
    img.onload = () => {
      const ctx = c.getContext('2d');
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      ctx.restore();
    };
    img.src = dataUrl;
  }

  useEffect(() => {
    setup();
    window.addEventListener('resize', setup);
    return () => window.removeEventListener('resize', setup);
  }, [setup]);

  useImperativeHandle(ref, () => ({
    isEmpty: () => !inked.current,
    toDataURL: () => canvasRef.current.toDataURL('image/png'),
    clear: () => {
      inked.current = false;
      paintBackground();
      onChange?.(null);
    },
    load: (dataUrl) => {
      if (!dataUrl) return;
      inked.current = true;
      drawImage(dataUrl);
    },
  }));

  const point = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    // a tap draws a dot
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    inked.current = true;
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = point(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange?.(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ height, touchAction: 'none' }}
      className="w-full rounded-xl border-2 border-dashed border-slate-300 bg-white cursor-crosshair"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
      aria-label="Customer signature pad"
    />
  );
});

export default SignaturePad;
