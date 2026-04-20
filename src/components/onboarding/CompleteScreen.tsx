import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import MomentumainlLogo from "../icons/MomentumainlLogo";

interface CompleteScreenProps {
  onComplete: () => void;
}

const CompleteScreen: React.FC<CompleteScreenProps> = ({ onComplete }) => {
  const { t } = useTranslation();

  useEffect(() => {
    const timer = setTimeout(onComplete, 2600);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center gap-12 cursor-default"
      onClick={onComplete}
    >
      <div
        style={{
          animation: "float-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          opacity: 0,
        }}
      >
        <MomentumainlLogo width={130} />
      </div>

      <div className="flex flex-col items-center gap-3">
        <h1
          className="text-[22px] font-normal text-text tracking-tight"
          style={{
            animation: "fade-in 0.6s ease-out forwards",
            animationDelay: "0.6s",
            opacity: 0,
          }}
        >
          {t("onboarding.complete.ready")}
        </h1>
        <p
          className="text-sm text-text/50"
          style={{
            animation: "fade-in 0.6s ease-out forwards",
            animationDelay: "1.1s",
            opacity: 0,
          }}
        >
          {t("onboarding.complete.tagline")}
        </p>
      </div>
    </div>
  );
};

export default CompleteScreen;
