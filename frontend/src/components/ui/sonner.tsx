"use client";

import { useTheme } from "next-themes@0.4.6";
import { Toaster as Sonner, ToasterProps } from "sonner@2.0.3";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      richColors
      position="top-right"
      closeButton
      front={true}
      theme={theme as ToasterProps["theme"]}
      className="group toaster"
      {...props}
    />
  );
};

export { Toaster };
