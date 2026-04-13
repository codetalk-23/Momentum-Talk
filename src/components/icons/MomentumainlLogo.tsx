import React from "react";

const MomentumainlLogo = ({
  width,
  height,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) => {
  return (
    <img
      src="/momentumainl_logo.jpeg"
      alt="Momentumainl Logo"
      width={width}
      height={height}
      className={className}
      style={{ maxWidth: "100%", height: "auto" }}
    />
  );
};

export default MomentumainlLogo;
