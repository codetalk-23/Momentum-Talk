import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const DOWNLOAD_URL = "https://talk.momentumai.nl/";
const URL_SHORT = "talk.momentumai.nl";

interface ReferralModalProps {
  onClose: () => void;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const message = `${t("referral.friendMessage")}\n\n${DOWNLOAD_URL}`;

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2600);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="referral-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        zIndex: 999,
        animation: "rm-fade .25s ease",
        fontFamily: "'Calibri', 'Trebuchet MS', sans-serif",
      }}
    >
      <style>{KEYFRAMES}</style>

      {/* Close */}
      <button
        ref={closeRef}
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "absolute",
          top: 20,
          right: 24,
          zIndex: 30,
          width: 32,
          height: 32,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.2)",
          background: "rgba(255,255,255,0.12)",
          color: "#fff",
          cursor: "pointer",
          fontSize: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ×
      </button>

      {/* Scene */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          animation: "rm-rise .5s cubic-bezier(0.2,0.9,0.3,1.1)",
          padding: "0 24px",
        }}
      >
        {/* Headline */}
        <h1
          id="referral-title"
          style={{
            margin: 0,
            fontSize: "clamp(22px, 4vw, 32px)",
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: "#fff",
          }}
        >
          {t("referral.title")}{" "}
          <span style={{ color: "#52b788", fontStyle: "italic" }}>
            {t("referral.titleAccent")}
          </span>
        </h1>

        {/* Postcard */}
        <div
          style={{
            position: "relative",
            width: 480,
            maxWidth: "calc(100vw - 48px)",
            aspectRatio: "1.6 / 1",
            background: "#FFFFFF",
            borderRadius: 8,
            boxShadow: "0 32px 64px -20px rgba(0,0,0,0.5), 0 2px 0 rgba(0,0,0,0.06)",
            transform: "rotate(-0.8deg)",
            display: "grid",
            gridTemplateColumns: "1fr 1px 1fr",
            overflow: "hidden",
          }}
        >
          {/* LEFT — message */}
          <div style={{ padding: "28px 26px", display: "flex", alignItems: "center" }}>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: "#0A0A0A", fontStyle: "italic" }}>
              "{t("referral.friendMessage")}"
            </p>
          </div>

          {/* Divider */}
          <div style={{ background: "#E8E8E8" }} />

          {/* RIGHT — stamp + url */}
          <div style={{ position: "relative", padding: "20px 20px" }}>
            {/* Stamp */}
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                width: 60,
                height: 70,
                background: "#1A3D2B",
                color: "#fff",
                borderRadius: 3,
                padding: 4,
                boxShadow: "0 4px 12px -4px rgba(0,0,0,0.25)",
                clipPath:
                  "polygon(0 4%,4% 0,8% 4%,12% 0,16% 4%,20% 0,24% 4%,28% 0,32% 4%,36% 0,40% 4%,44% 0,48% 4%,52% 0,56% 4%,60% 0,64% 4%,68% 0,72% 4%,76% 0,80% 4%,84% 0,88% 4%,92% 0,96% 4%,100% 0,100% 100%,0 100%)",
              }}
            >
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.3)",
                  height: "100%",
                  borderRadius: 2,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                }}
              >
                <img src="/logo-transparent.png" alt="Momentum Talk" style={{ width: 28, height: 28, objectFit: "contain", filter: "invert(1)", opacity: 0.9 }} />
                <div style={{ fontSize: 7, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7, fontFamily: "monospace" }}>Talk</div>
              </div>
            </div>

            {/* URL */}
            <div
              style={{
                position: "absolute",
                bottom: 20,
                left: 20,
                right: 20,
                fontFamily: "monospace",
                fontSize: 11,
                letterSpacing: "0.06em",
                color: "#1A3D2B",
                fontWeight: 700,
                opacity: 0.75,
              }}
            >
              {URL_SHORT}
            </div>

            {/* Copied seal */}
            {copied && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  animation: "rm-seal .5s cubic-bezier(0.2,0.9,0.3,1.2) forwards",
                  zIndex: 4,
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    border: "2.5px solid #1A3D2B",
                    color: "#1A3D2B",
                    padding: "6px 16px",
                    borderRadius: 4,
                    fontFamily: "monospace",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    fontSize: 13,
                    letterSpacing: "0.28em",
                    background: "rgba(255,255,255,0.92)",
                    textTransform: "uppercase",
                  }}
                >
                  {t("referral.sentSeal")} ✓
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CTA button */}
        <button
          onClick={handleCopy}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          style={{
            padding: "13px 28px",
            background: copied ? "#2D6A4F" : "#1A3D2B",
            color: "#fff",
            border: 0,
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.02em",
            fontFamily: "inherit",
            cursor: "pointer",
            transition: "transform .08s ease, background .25s ease",
            minWidth: 220,
          }}
        >
          {copied ? `✓  ${t("referral.copied")}` : t("referral.copyCta")}
        </button>
      </div>
    </div>
  );
};


const KEYFRAMES = `
@keyframes rm-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes rm-rise {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes rm-seal {
  0%   { transform: translate(-50%,-50%) scale(0) rotate(18deg); opacity: 0; }
  65%  { transform: translate(-50%,-50%) scale(1.1) rotate(-5deg); opacity: 1; }
  100% { transform: translate(-50%,-50%) scale(1) rotate(-6deg); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; }
}
`;
