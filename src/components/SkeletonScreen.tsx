import { memo } from "react";
import { cn } from "@/lib/utils";

/**
 * iOS-Style Skeleton Screens
 * Replaces loading spinners with beautiful content placeholders
 */

interface SkeletonProps {
  className?: string;
}

export const Skeleton = memo(({ className }: SkeletonProps) => (
  <div
    className={cn(
      "animate-skeleton-pulse rounded-md bg-muted",
      className
    )}
  />
));

Skeleton.displayName = "Skeleton";

// Card skeleton for dashboard
export const DashboardCardSkeleton = memo(() => (
  <div className="border border-border rounded-lg overflow-hidden">
    <Skeleton className="aspect-video" />
    <div className="p-4 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-10 w-full" />
    </div>
  </div>
));

DashboardCardSkeleton.displayName = "DashboardCardSkeleton";

// Dish card skeleton for menus
export const DishCardSkeleton = memo(() => (
  <div className="space-y-2">
    <Skeleton className="aspect-square rounded-2xl" />
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-3 w-1/2" />
    <Skeleton className="h-4 w-1/3" />
  </div>
));

DishCardSkeleton.displayName = "DishCardSkeleton";

// Restaurant header skeleton
export const RestaurantHeaderSkeleton = memo(() => (
  <div className="w-full">
    <Skeleton className="h-64 md:h-80 w-full" />
    <div className="container mx-auto px-4 -mt-12 relative z-10">
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-4 w-64" />
    </div>
  </div>
));

RestaurantHeaderSkeleton.displayName = "RestaurantHeaderSkeleton";

// Navigation skeleton
export const NavSkeleton = memo(() => (
  <div className="flex gap-3 px-4 py-3">
    {[1, 2, 3, 4].map((i) => (
      <Skeleton key={i} className="h-9 w-24 rounded-full" />
    ))}
  </div>
));

NavSkeleton.displayName = "NavSkeleton";

// List skeleton for tables
export const ListSkeleton = memo(({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    ))}
  </div>
));

ListSkeleton.displayName = "ListSkeleton";

// Form skeleton
export const FormSkeleton = memo(() => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-10 w-full" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-24 w-full" />
    </div>
    <Skeleton className="h-10 w-32" />
  </div>
));

FormSkeleton.displayName = "FormSkeleton";

// Grid skeleton for menus
export const MenuGridSkeleton = memo(({ items = 8 }: { items?: number }) => (
  <div className="px-6 py-8">
    <Skeleton className="h-8 w-48 mb-6" />
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: items }).map((_, i) => (
        <DishCardSkeleton key={i} />
      ))}
    </div>
  </div>
));

MenuGridSkeleton.displayName = "MenuGridSkeleton";

// Editor skeleton
export const EditorSkeleton = memo(() => (
  <div className="min-h-screen bg-background">
    <Skeleton className="h-16 w-full" />
    <Skeleton className="h-64 w-full" />
    <div className="container mx-auto px-4 py-4">
      <NavSkeleton />
      <div className="mt-6">
        <MenuGridSkeleton />
      </div>
    </div>
  </div>
));

EditorSkeleton.displayName = "EditorSkeleton";

// Text skeleton (for inline loading)
export const TextSkeleton = memo(({ length = "medium" }: { length?: "short" | "medium" | "long" }) => {
  const widthClass = {
    short: "w-16",
    medium: "w-32",
    long: "w-64",
  }[length];

  return <Skeleton className={cn("h-4", widthClass)} />;
});

TextSkeleton.displayName = "TextSkeleton";

// Image skeleton with blur-up effect
export const ImageSkeleton = memo(({ aspectRatio = "square" }: { aspectRatio?: "square" | "video" | "portrait" }) => {
  const aspectClass = {
    square: "aspect-square",
    video: "aspect-video",
    portrait: "aspect-[3/4]",
  }[aspectRatio];

  return (
    <div className={cn("relative overflow-hidden rounded-lg", aspectClass)}>
      <Skeleton className="absolute inset-0" />
      <div className="absolute inset-0 animate-shimmer" />
    </div>
  );
});

ImageSkeleton.displayName = "ImageSkeleton";

// Button skeleton
export const ButtonSkeleton = memo(({ size = "default" }: { size?: "sm" | "default" | "lg" }) => {
  const sizeClass = {
    sm: "h-8 w-20",
    default: "h-10 w-24",
    lg: "h-12 w-32",
  }[size];

  return <Skeleton className={cn("rounded-md", sizeClass)} />;
});

ButtonSkeleton.displayName = "ButtonSkeleton";

// Avatar skeleton
export const AvatarSkeleton = memo(() => (
  <Skeleton className="h-10 w-10 rounded-full" />
));

AvatarSkeleton.displayName = "AvatarSkeleton";

// Badge skeleton
export const BadgeSkeleton = memo(() => (
  <Skeleton className="h-6 w-16 rounded-full" />
));

BadgeSkeleton.displayName = "BadgeSkeleton";

// Table skeleton
export const TableSkeleton = memo(({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) => (
  <div className="space-y-3">
    <div className="flex gap-4">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="h-10 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4">
        {Array.from({ length: columns }).map((_, j) => (
          <Skeleton key={j} className="h-12 flex-1" />
        ))}
      </div>
    ))}
  </div>
));

TableSkeleton.displayName = "TableSkeleton";
