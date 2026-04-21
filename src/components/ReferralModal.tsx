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
        <div style={{ textAlign: "center", color: "#fff" }}>
          <h1
            id="referral-title"
            style={{
              margin: 0,
              fontSize: "clamp(28px, 5vw, 42px)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            {t("referral.title")}{" "}
            <span style={{ color: "#52b788", fontStyle: "italic" }}>
              {t("referral.titleAccent")}
            </span>
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, opacity: 0.6, fontWeight: 400 }}>
            {t("referral.subtitle")}
          </p>
        </div>

        {/* Postcard */}
        <div
          style={{
            position: "relative",
            width: 560,
            maxWidth: "calc(100vw - 48px)",
            aspectRatio: "1.6 / 1",
            background: "#FFFFFF",
            borderRadius: 8,
            boxShadow: "0 32px 64px -20px rgba(0,0,0,0.5), 0 2px 0 rgba(0,0,0,0.06)",
            transform: "rotate(-0.8deg)",
            overflow: "visible",
            display: "grid",
            gridTemplateColumns: "1fr 1px 1fr",
          }}
        >
          {/* Inner clip for card contents */}
          <div style={{ overflow: "hidden", borderRadius: "8px 0 0 8px", padding: "22px 24px", position: "relative", display: "flex", flexDirection: "column" }}>
            <div style={monoLabel}>{t("referral.messageLabel")}</div>
            <p
              style={{
                margin: "12px 0 0",
                fontSize: 17,
                lineHeight: 1.45,
                color: "#0A0A0A",
                fontStyle: "italic",
                flex: 1,
              }}
            >
              "{t("referral.friendMessage")}"
            </p>
            <div style={{ fontSize: 13, color: "#888", fontStyle: "italic", marginTop: 8 }}>
              — {t("referral.signoff")}
            </div>
          </div>

          {/* Divider */}
          <div style={{ background: "#E8E8E8" }} />

          {/* RIGHT */}
          <div style={{ position: "relative", padding: "22px 24px", borderRadius: "0 8px 8px 0", overflow: "hidden" }}>
            {/* Stamp */}
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 18,
                width: 72,
                height: 84,
                background: "#1A3D2B",
                color: "#fff",
                borderRadius: 3,
                padding: 5,
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
                <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.7, fontFamily: "monospace" }}>NL</div>
                <img src="/logo-transparent.png" alt="Momentum Talk" style={{ width: 34, height: 34, objectFit: "contain", filter: "invert(1)", opacity: 0.9 }} />
                <div style={{ fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7, fontFamily: "monospace" }}>Talk</div>
              </div>
            </div>

            {/* Postmark */}
            <div
              style={{
                position: "absolute",
                top: 52,
                right: 88,
                width: 62,
                height: 62,
                borderRadius: 999,
                border: "1.5px solid rgba(26,61,43,0.35)",
                color: "rgba(26,61,43,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "monospace",
                fontSize: 8,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                textAlign: "center",
                lineHeight: 1.4,
                transform: "rotate(-12deg)",
              }}
            >
              AMS<br />·2026·<br />MMT
            </div>

            {/* Address */}
            <div style={{ marginTop: 16 }}>
              <div style={monoLabel}>{t("referral.addressLabel")}</div>
              <div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.6, color: "#0A0A0A" }}>
                {(t("referral.addressLines", { returnObjects: true }) as string[]).map((ln, i) => (
                  <div key={i}>{ln}</div>
                ))}
              </div>
            </div>

            {/* Link strip at bottom */}
            <div
              style={{
                position: "absolute",
                left: 20,
                right: 20,
                bottom: 16,
                height: 32,
                borderRadius: 5,
                border: "1px dashed rgba(0,0,0,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "monospace",
                fontSize: 12,
                letterSpacing: "0.04em",
                color: "#1A3D2B",
                fontWeight: 600,
              }}
            >
              {URL_SHORT}
            </div>

            {/* Copied seal — center-right of the card */}
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

const monoLabel: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 9,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "#888",
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
