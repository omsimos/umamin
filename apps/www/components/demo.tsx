"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Card, CardHeader } from "@umamin/ui/components/card";
import { BadgeCheckIcon, LockIcon, ScanFaceIcon } from "lucide-react";
import { AnimatedShinyText } from "./animated-shiny-text";
import { GridPattern } from "./grid-pattern";

export function Demo() {
  return (
    <div className="relative w-full grid place-items-center py-10">
      <GridPattern />

      <Card className="border flex flex-col p-0 overflow-hidden">
        <CardHeader className="bg-background py-6 flex justify-between items-center">
          <div className="flex items-center space-x-1">
            <span className="text-muted-foreground">To:</span>
            <p className="font-semibold text-sm">Umamin Official</p>
            <BadgeCheckIcon className="w-4 h-4 text-pink-500" />
          </div>

          <span className="font-semibold text-muted-foreground">umamin</span>
        </CardHeader>

        <div className="flex flex-col px-5 sm:px-7 pt-10 pb-8 min-h-[270px] h-full">
          <div className="flex gap-2 items-center">
            <Avatar>
              <AvatarImage
                className="rounded-full"
                src="https://lh3.googleusercontent.com/a/ACg8ocK4CtuGuDZlPy9H_DMb3EQIue9Hrd5bqYcMZOY-Xb8LcuyqsBI=s96-c"
              />
              <AvatarFallback>
                <ScanFaceIcon />
              </AvatarFallback>
            </Avatar>
            <div className="max-w-[75%] sm:max-w-[55%] rounded-lg px-3 py-2 whitespace-pre-wrap bg-muted min-w-0 break-words">
              Send me an anonymous message!
            </div>
          </div>

          <div className="sm:max-w-[70%] max-w-[75%] bg-muted rounded-lg px-3 py-2 self-end mt-6">
            <AnimatedShinyText>
              SVHPJZ57QbFTnt3CqdpV+JPg6GCgPh/MbCXA/TsXRAWYEwQN2Xwtcl4=
            </AnimatedShinyText>
          </div>
          <span className="text-muted-foreground mt-2 text-sm text-right flex self-end gap-1 items-center">
            <LockIcon className="size-3" />
            Advanced Encryption Standard
            <LockIcon className="size-3" />
          </span>
        </div>
      </Card>
    </div>
  );
}
