import * as React from "react";
import { useState, useMemo } from "react";
import type { Company, Speaker } from "@/types/clients";
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
import { Check, ChevronsUpDown, Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface CompanySpeakerSelectorProps {
  companies: Company[];
  speakers: Speaker[];
  selectedCompanyId: string | null;
  selectedSpeakerId: string | null;
  onCompanyChange: (id: string | null) => void;
  onSpeakerChange: (id: string | null) => void;
  showAllSpeakersOption?: boolean;
  disabled?: boolean;
}

export function CompanySpeakerSelector({
  companies,
  speakers,
  selectedCompanyId,
  selectedSpeakerId,
  onCompanyChange,
  onSpeakerChange,
  showAllSpeakersOption = false,
  disabled = false,
}: CompanySpeakerSelectorProps) {
  const [companyOpen, setCompanyOpen] = useState(false);
  const [speakerOpen, setSpeakerOpen] = useState(false);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId),
    [companies, selectedCompanyId]
  );

  const filteredSpeakers = useMemo(
    () => speakers.filter((s) => s.company_id === selectedCompanyId),
    [speakers, selectedCompanyId]
  );

  const selectedSpeaker = useMemo(
    () => speakers.find((s) => s.id === selectedSpeakerId),
    [speakers, selectedSpeakerId]
  );

  const handleCompanyChange = (id: string | null) => {
    onCompanyChange(id);
    onSpeakerChange(null); // Reset speaker when company changes
  };

  return (
    <div className="grid gap-3">
      {/* Step 1: Company Selection */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Company</Label>
        <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={companyOpen}
              className="w-full justify-between"
              disabled={disabled}
            >
              <span className="flex items-center gap-2 truncate">
                <Building2 className="h-4 w-4 opacity-70" />
                {selectedCompany ? (
                  selectedCompany.name
                ) : (
                  <span className="text-muted-foreground">Select company...</span>
                )}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-50" align="start">
            <Command>
              <CommandInput placeholder="Search companies..." className="h-9" />
              <CommandList>
                <CommandEmpty>No companies found.</CommandEmpty>
                <CommandGroup>
                  {companies.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={c.name}
                      onSelect={() => {
                        handleCompanyChange(c.id);
                        setCompanyOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedCompanyId === c.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{c.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Step 2: Speaker Selection */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Speaker</Label>
        <Popover open={speakerOpen} onOpenChange={setSpeakerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={speakerOpen}
              className="w-full justify-between"
              disabled={disabled || !selectedCompanyId}
            >
              <span className="flex items-center gap-2 truncate">
                <User className="h-4 w-4 opacity-70" />
                {selectedSpeakerId === "all" ? (
                  "All Speakers (Company-Wide)"
                ) : selectedSpeaker ? (
                  <>
                    {selectedSpeaker.name}
                    {selectedSpeaker.title && (
                      <span className="text-muted-foreground">
                        — {selectedSpeaker.title}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    {selectedCompanyId ? "Select speaker..." : "Select company first"}
                  </span>
                )}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-50" align="start">
            <Command>
              <CommandInput placeholder="Search speakers..." className="h-9" />
              <CommandList>
                <CommandEmpty>No speakers found for this company.</CommandEmpty>
                <CommandGroup>
                  {showAllSpeakersOption && filteredSpeakers.length > 1 && (
                    <CommandItem
                      value="all-speakers-company-wide"
                      onSelect={() => {
                        onSpeakerChange("all");
                        setSpeakerOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedSpeakerId === "all" ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="font-medium">All Speakers (Company-Wide)</span>
                    </CommandItem>
                  )}
                  {filteredSpeakers.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={`${s.name} ${s.title || ""}`.trim()}
                      onSelect={() => {
                        onSpeakerChange(s.id);
                        setSpeakerOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedSpeakerId === s.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{s.name}</span>
                      {s.title && (
                        <span className="ml-2 truncate text-muted-foreground">
                          — {s.title}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
