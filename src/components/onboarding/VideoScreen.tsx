import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";

interface VideoScreenProps {
  onComplete: () => void;
}

const VideoScreen: React.FC<VideoScreenProps> = ({ onComplete }) => {
  const { i18n } = useTranslation();

  const getVideoPath = () => {
    const language = i18n.language;
    if (language === "nl") {
      return "/Momentum Talk nl.mp4";
    }
    return "/Momentum Talk eng.mp4";
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background cursor-default">
      <video
        src={getVideoPath()}
        controls
        autoPlay
        className="max-w-full max-h-full object-contain"
        onEnded={onComplete}
        style={{
          animation: "fade-in 0.8s ease-out forwards",
          opacity: 0,
        }}
      />
      <button
        onClick={onComplete}
        className="mt-8 px-8 py-2.5 rounded-lg bg-background-secondary border border-border-color text-text text-sm font-normal transition-all cursor-pointer hover:bg-border-color active:scale-[0.98]"
        style={{
          animation: "fade-in 0.6s ease-out forwards",
          animationDelay: "0.3s",
          opacity: 0,
        }}
      >
        Skip
      </button>
    </div>
  );
};

export default VideoScreen;
