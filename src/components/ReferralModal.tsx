import React, { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

const DOWNLOAD_URL = "https://www.momentumai.nl/talk";

interface ReferralModalProps {
  onClose: () => void;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  const message = `${t("referral.friendMessage")}\n\n${DOWNLOAD_URL}`;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function launchConfetti() {
    const canvas = canvasRef.current;
    const icon = iconRef.current;
    if (!canvas || !icon) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const iconRect = icon.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const originX = iconRect.left - canvasRect.left + iconRect.width / 2;
    const originY = iconRect.top - canvasRect.top + iconRect.height / 2;

    const colors = ["#2D6A4F", "#4CAF82", "#F9C74F", "#F4845F", "#90BE6D", "#577590", "#F94144", "#ffffff"];

    const pieces = Array.from({ length: 100 }, () => ({
      x: originX,
      y: originY,
      vx: (Math.random() - 0.5) * 12,
      vy: -(Math.random() * 14 + 5),
      size: Math.random() * 7 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      shape: Math.random() > 0.4 ? "rect" : "circle",
      opacity: 1,
    }));

    let frame = 0;
    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      frame++;
      let alive = false;

      pieces.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.4;
        p.vx *= 0.98;
        p.rotation += p.rotSpeed;
        if (frame > 50) p.opacity -= 0.02;
        if (p.opacity <= 0) return;
        alive = true;

        ctx!.save();
        ctx!.globalAlpha = Math.max(0, p.opacity);
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.rotation * Math.PI) / 180);
        ctx!.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx!.beginPath();
          ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.restore();
      });

      if (alive) requestAnimationFrame(animate);
      else ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
    }

    animate();
  }

  function handleCopy() {
    navigator.clipboard.writeText(message);
    setCopied(true);
    launchConfetti();
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        zIndex: 999,
        overflow: "hidden",
      }}
      onClick={onClose}
    >
      {/* Confetti canvas — covers the whole overlay */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 30,
        }}
      />

      {/* Card */}
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          border: "0.5px solid rgba(0,0,0,0.1)",
          padding: "3rem 2.5rem 2.5rem",
          maxWidth: 440,
          width: "100%",
          textAlign: "center",
          position: "relative",
          zIndex: 20,
          fontFamily: "inherit",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* X close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 18,
            background: "none",
            border: "none",
            fontSize: 20,
            color: "#aaa",
            cursor: "pointer",
            padding: 0,
            lineHeight: 1,
          }}
          aria-label="Sluiten"
        >
          ×
        </button>

        {/* Icon box — confetti origin */}
        <div ref={iconRef} style={{ marginBottom: "1.75rem" }}>
          <div
            style={{
              width: 64,
              height: 64,
              background: "#F5F4F0",
              borderRadius: 14,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src="/present-svgrepo-com.svg"
              alt=""
              aria-hidden="true"
              style={{ width: 28, height: 28, filter: "brightness(0) saturate(100%) invert(31%) sepia(29%) saturate(760%) hue-rotate(104deg) brightness(85%) contrast(90%)" }}
            />
          </div>
        </div>

        {/* Heading */}
        <h2
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#111",
            margin: "0 0 2rem",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
          }}
        >
          {t("referral.title")}
        </h2>

        {/* Subtext */}
        {t("referral.description") && (
          <p
            style={{
              fontSize: 14,
              color: "#888",
              margin: "0 0 1.75rem",
              lineHeight: 1.6,
            }}
          >
            {t("referral.description")}
          </p>
        )}

        {/* Message preview */}
        <div
          style={{
            background: "#f7f7f5",
            border: "1px solid #E8E8E8",
            borderRadius: 12,
            padding: "1.25rem 1.5rem",
            textAlign: "left",
            marginBottom: "1.25rem",
          }}
        >
          <p style={{ fontSize: 15, color: "#111", margin: "0 0 8px", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {t("referral.friendMessage")}
          </p>
          <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
            {DOWNLOAD_URL}
          </p>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          style={{
            width: "100%",
            padding: 15,
            borderRadius: 12,
            background: copied ? "#2D6A4F" : "#1A3D2B",
            color: "#fff",
            border: `1px solid ${copied ? "#2D6A4F" : "#1A3D2B"}`,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "0.02em",
            transition: "background 0.2s",
            fontFamily: "inherit",
          }}
        >
          {copied ? `${t("referral.copied")} ✓` : t("referral.copy")}
        </button>
      </div>
    </div>
  );
};
