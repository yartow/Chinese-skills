import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface ScriptToggleProps {
  isTraditional: boolean;
  onToggle: (isTraditional: boolean) => void;
}

export default function ScriptToggle({ isTraditional, onToggle }: ScriptToggleProps) {
  return (
    <div className="flex items-center gap-3" data-testid="script-toggle">
      <Label htmlFor="script-toggle" className="text-sm font-medium">
        {isTraditional ? "Traditional" : "Simplified"}
      </Label>
      <Switch
        id="script-toggle"
        checked={isTraditional}
        onCheckedChange={onToggle}
        data-testid="switch-script"
      />
    </div>
  );
}
