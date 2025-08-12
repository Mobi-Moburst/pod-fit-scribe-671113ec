import * as React from "react";
import { useState, useMemo } from "react";
import type { MinimalClient } from "@/types/clients";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientComboboxProps {
  clients: MinimalClient[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

export function ClientCombobox({ clients, value, onChange, placeholder = "Select client..." }: ClientComboboxProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => clients.find((c) => c.id === value), [clients, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
       >
          <span className="flex items-center gap-2 truncate">
            <User className="h-4 w-4 opacity-70" />
            {selected ? selected.name : <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-50" align="start">
        <Command>
          <CommandInput placeholder="Search clients..." className="h-9" />
          <CommandList>
            <CommandEmpty>No clients found.</CommandEmpty>
            <CommandGroup>
              {clients.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.company ?? ""}`.trim()}
                  keywords={[c.name, c.company ?? ""]}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{c.name}</span>
                  {c.company && (
                    <span className="ml-2 truncate text-muted-foreground">— {c.company}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
