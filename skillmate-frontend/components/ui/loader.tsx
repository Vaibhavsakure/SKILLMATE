import { Loader2 } from "lucide-react"

export function Loader({ className }: { className?: string }) {
    return (
        <div className={`flex justify-center p-4 ${className}`}>
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
    )
}
