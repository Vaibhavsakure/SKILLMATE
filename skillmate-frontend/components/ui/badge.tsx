import { cn } from "@/lib/utils"

interface BadgeProps {
    children: React.ReactNode
    variant?: "default" | "secondary" | "destructive" | "outline" | "success"
    className?: string
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
    const variants = {
        default: "bg-slate-900 text-white hover:bg-slate-700",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
        destructive: "bg-red-50 text-red-700 border border-red-200",
        success: "bg-green-50 text-green-700 border border-green-200",
        outline: "text-slate-950 border border-slate-200"
    }

    return (
        <span className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            variants[variant],
            className
        )}>
            {children}
        </span>
    )
}
