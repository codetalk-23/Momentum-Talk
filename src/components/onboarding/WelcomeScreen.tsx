import React from "react";
import { useTranslation } from "react-i18next";
import MomentumainlLogo from "../icons/MomentumainlLogo";

interface WelcomeScreenProps {
  onComplete: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onComplete }) => {
  const { t } = useTranslation();

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center gap-12 cursor-default px-8">
      <div
        style={{
          animation: "float-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          opacity: 0,
        }}
      >
        <MomentumainlLogo width={150} />
      </div>

      <div
        className="flex flex-col items-center gap-3 text-center"
        style={{
          animation: "fade-in 0.7s ease-out forwards",
          animationDelay: "0.5s",
          opacity: 0,
        }}
      >
        <h1 className="text-[22px] font-normal text-text tracking-tight">
          {t("onboarding.welcome.title")}
        </h1>
        <p className="text-sm text-text/50 max-w-[260px] leading-relaxed">
          {t("onboarding.welcome.subtitle")}
        </p>
      </div>

      <button
        onClick={onComplete}
        className="px-8 py-2.5 rounded-lg bg-background-secondary border border-border-color text-text text-sm font-normal transition-all cursor-pointer hover:bg-border-color active:scale-[0.98]"
        style={{
          animation: "fade-in 0.6s ease-out forwards",
          animationDelay: "1.1s",
          opacity: 0,
        }}
      >
        {t("onboarding.welcome.continue")}
      </button>
    </div>
  );
};

export default WelcomeScreen;
