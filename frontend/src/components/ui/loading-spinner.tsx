import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  text?: string;
}

const sizeClasses = {
  sm: "w-4 h-4 border-2",
  md: "w-8 h-8 border-2",
  lg: "w-12 h-12 border-3",
  xl: "w-16 h-16 border-4"
};

const textSizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl"
};

export function LoadingSpinner({ size = "md", className, text }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col justify-center items-center gap-4">
      <div
        className={cn(
          "border-primary border-r-transparent rounded-full animate-spin",
          sizeClasses[size],
          className
        )}
        style={{
          borderStyle: 'solid',
          borderWidth: '6px',
        }}
      />
      {text && (
        <p className={cn(
          "font-medium text-muted-foreground",
          textSizeClasses[size]
        )}>
          {text}
        </p>
      )}
    </div>
  );
}

interface LoadingPageProps {
  text?: string;
}

export function LoadingPage({ text = "Loading..." }: LoadingPageProps) {
  return (
    <div className="z-50 flex justify-center items-center bg-background p-4 min-h-screen">
      <div className="space-y-6 text-center">
        <LoadingSpinner size="xl" />
        <div className="space-y-2">
          <h2 className="font-semibold text-foreground text-2xl">{text}</h2>
          <p className="text-muted-foreground">Please wait while we set things up for you.</p>
        </div>
      </div>
    </div>
  );
}

interface LoadingOverlayProps {
  isVisible: boolean;
  text?: string;
}

export function LoadingOverlay({ isVisible, text = "Loading..." }: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="z-50 fixed inset-0 flex justify-center items-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background shadow-xl p-6 rounded-lg w-full max-w-sm text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 font-medium text-foreground text-lg">{text}</p>
      </div>
    </div>
  );
}
