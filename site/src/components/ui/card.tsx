import { createContext, useContext, type ComponentProps } from "react"

import { cn } from "@/lib/utils"

type CardSize = "default" | "sm"

const CardSizeContext = createContext<CardSize>("default")

function Card({
  className,
  size = "default",
  ...props
}: ComponentProps<"div"> & { size?: CardSize }) {
  return (
    <CardSizeContext.Provider value={size}>
      <div
        data-slot="card"
        className={cn(
          "flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs",
          className
        )}
        {...props}
      />
    </CardSizeContext.Provider>
  )
}

function CardHeader({ className, ...props }: ComponentProps<"div">) {
  const size = useContext(CardSizeContext)
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-4",
        size === "sm" ? "gap-1 p-3" : "gap-1 p-4",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: ComponentProps<"div">) {
  const size = useContext(CardSizeContext)
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-medium text-card-foreground",
        size === "sm" ? "text-sm leading-5" : "text-base leading-6",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: ComponentProps<"div">) {
  const size = useContext(CardSizeContext)
  return (
    <div
      data-slot="card-content"
      className={cn(
        size === "sm" ? "px-3 pb-3" : "px-4 pb-4",
        className
      )}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: ComponentProps<"div">) {
  const size = useContext(CardSizeContext)
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center border-t border-border bg-muted/50",
        size === "sm" ? "p-3" : "p-4",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
